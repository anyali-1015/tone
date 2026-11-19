"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CurrencyChip, RegisterChip } from "@/components/chips";
import { IconLoop, IconMic, IconPause, IconPlay, IconTrash } from "@/components/icons";
import { ShadowMode } from "@/components/ShadowMode";
import { YouTubePlayer, type PlayerHandle } from "@/components/YouTubePlayer";
import { callAi } from "@/lib/ai";
import { formatTime } from "@/lib/captions";
import { db, logActivity } from "@/lib/db";
import { savePhrase } from "@/lib/phrases";
import { useSettings } from "@/lib/settings";
import type { Phrase, PhraseInfo, Video } from "@/lib/types";
import { useCoarsePointer } from "@/lib/useCoarsePointer";

const SPEEDS = [0.5, 0.75, 1];

export default function PlayerPage() {
  return (
    <Suspense fallback={null}>
      <PlayerPageInner />
    </Suspense>
  );
}

function PlayerPageInner() {
  const { id } = useParams<{ id: string }>();
  const video = useLiveQuery(async () => (await db.videos.get(id)) ?? null, [id]);
  const phrases = useLiveQuery(
    () => db.phrases.filter((p) => p.source.kind === "video" && p.source.videoId === id).toArray(),
    [id],
  );
  if (video === undefined) return null;
  if (video === null) {
    return (
      <p>
        Video not found. <Link href="/watch">Back to Watch</Link>
      </p>
    );
  }
  return <Player video={video} phrases={phrases ?? []} />;
}

interface Selection {
  text: string;
  line: number;
}

function Player({ video, phrases }: { video: Video; phrases: Phrase[] }) {
  const router = useRouter();
  const settings = useSettings();
  const player = useRef<PlayerHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(video.currentLine);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(settings.defaultSpeed);
  const [tab, setTab] = useState<"transcript" | "phrases">("transcript");
  const [shadow, setShadow] = useState(false);
  const [sel, setSel] = useState<Selection | null>(null);
  const timed = video.lines.some((l) => l.start >= 0);
  const lines = video.lines;

  /* Follow the video: highlight the line that's playing. */
  useEffect(() => {
    if (!timed || shadow) return;
    const t = window.setInterval(() => {
      const p = player.current;
      if (!p) return;
      const now = p.time();
      if (loop) {
        const l = lines[current];
        if (l && l.start >= 0 && now > l.start + Math.max(1, l.dur) + 0.2) p.seek(l.start);
        return;
      }
      let i = lines.findIndex((l, k) => l.start <= now && (k === lines.length - 1 || lines[k + 1].start > now));
      if (i < 0) i = 0;
      setCurrent((c) => (c === i ? c : i));
    }, 150);
    return () => window.clearInterval(t);
  }, [timed, shadow, loop, current, lines]);

  /* Keep the playing line centered; remember progress. */
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-line="${current}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = window.setTimeout(() => db.videos.update(video.id, { currentLine: current, updatedAt: Date.now() }), 600);
    return () => window.clearTimeout(t);
  }, [current, video.id]);

  /* Watching time counts toward Culture (real context); shadowing logs Accent itself. */
  useEffect(() => {
    if (!playing || shadow) return;
    const started = Date.now();
    return () => void logActivity("Culture", (Date.now() - started) / 1000);
  }, [playing, shadow]);

  const jump = useCallback(
    (i: number) => {
      const l = lines[i];
      if (!l) return;
      setCurrent(i);
      if (l.start >= 0) {
        player.current?.seek(l.start);
        player.current?.play();
      }
    },
    [lines],
  );

  const togglePlay = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (p.playing()) p.pause();
    else p.play();
  }, []);

  /* Keyboard: Space, ←/→, L, R (spec §10 rules). */
  useEffect(() => {
    if (shadow) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        jump(Math.min(lines.length - 1, current + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        jump(Math.max(0, current - 1));
      } else if (e.key === "l" || e.key === "L") {
        setLoop((v) => !v);
      } else if ((e.key === "r" || e.key === "R") && !e.repeat) {
        e.preventDefault();
        setShadow(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shadow, togglePlay, jump, current, lines.length]);

  /* Phones don't fire mouseup after a long-press selection, so watch the selection itself. */
  const coarse = useCoarsePointer();
  useEffect(() => {
    if (!coarse) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (listRef.current?.contains(window.getSelection()?.anchorNode ?? null)) onMouseUp();
      }, 450);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", onChange);
    };
  });

  function onMouseUp() {
    const s = window.getSelection();
    const text = s?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!text || text.split(" ").length > 12) return;
    const node = s?.anchorNode?.parentElement?.closest<HTMLElement>("[data-line]");
    if (!node) return;
    setSel({ text: text.replace(/^[^\w']+|[^\w']+$/g, ""), line: Number(node.dataset.line) });
  }

  const savedTexts = useMemo(() => phrases.map((p) => p.text.toLowerCase()).filter(Boolean), [phrases]);

  async function remove() {
    if (!confirm("Remove this video? Phrases you saved from it stay in your Notebook.")) return;
    await db.videos.delete(video.id);
    await db.recordings.where("videoId").equals(video.id).delete();
    router.push("/watch");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link href="/watch" className="text-sm no-underline" style={{ color: "var(--muted)" }}>
            ‹ Watch
          </Link>
          <h1 className="m-0 text-[26px] leading-8 font-semibold tracking-tight">{video.title}</h1>
          <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
            {video.channel ? `${video.channel} · ` : ""}
            {lines.length} lines · {phrases.length} phrase{phrases.length === 1 ? "" : "s"} saved · {video.shadowedLines.length} shadowed
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>
          <IconTrash size={16} /> Remove video
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        <section aria-label="Video" className="flex min-w-0 flex-[3_1_480px] flex-col gap-3.5 md:sticky md:top-6">
          <div className="-mx-4 aspect-video overflow-hidden md:mx-0 md:rounded-[20px]" style={{ background: "#000" }}>
            <YouTubePlayer
              ref={player}
              videoId={video.youtubeId}
              onReady={() => {
                player.current?.setRate(speed);
                const l = lines[video.currentLine];
                if (l && l.start > 0) player.current?.seek(l.start);
                player.current?.pause();
              }}
              onPlayingChange={setPlaying}
            />
          </div>
          <div className="glass flex flex-wrap items-center gap-2 rounded-[28px] p-2 md:gap-2.5 md:rounded-full md:p-2.5" style={{ boxShadow: "var(--shadow-md)" }}>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "var(--ink)", color: "var(--bg)" }}
            >
              {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
            </button>
            <button type="button" className="btn" aria-pressed={loop} onClick={() => setLoop((v) => !v)} style={loop ? { background: "var(--accent-wash)" } : undefined}>
              <IconLoop size={16} />
              <span>
                Loop<span className="hidden sm:inline"> line</span>
              </span>
            </button>
            <div className="seg" role="group" aria-label="Speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => {
                    setSpeed(s);
                    player.current?.setRate(s);
                  }}
                >
                  {s === 1 ? "1.0×" : `${s}×`}
                </button>
              ))}
            </div>
            <div className="grow" />
            <button type="button" className="btn btn-primary" onClick={() => setShadow(true)}>
              <IconMic size={18} /> Shadow <span className="hidden text-xs opacity-80 md:inline">R</span>
            </button>
          </div>
          <p className="m-0 px-2 text-xs md:hidden" style={{ color: "var(--muted)" }}>
            Tap a line to jump to it · press and hold words to look them up and save
          </p>
          <p className="m-0 hidden px-2 text-xs md:block" style={{ color: "var(--muted)" }}>
            Space play/pause · ← → lines · L loop · R shadow · select words to save
          </p>
        </section>

        <section aria-label="Transcript" className="flex min-w-0 flex-[2_1_360px] flex-col gap-3">
          <div className="seg max-w-full self-start overflow-x-auto" role="tablist" aria-label="Transcript or phrases">
            <button type="button" role="tab" aria-selected={tab === "transcript"} onClick={() => setTab("transcript")}>
              Transcript
            </button>
            <button type="button" role="tab" aria-selected={tab === "phrases"} onClick={() => setTab("phrases")}>
              Phrases from this video · {phrases.length}
            </button>
          </div>

          {tab === "transcript" ? (
            <div ref={listRef} className="flex max-h-[65vh] flex-col gap-0.5 overflow-y-auto p-1 md:max-h-[calc(100vh-220px)]" onMouseUp={onMouseUp}>
              {lines.map((l, i) => (
                <div key={i} data-line={i} className="flex flex-col">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (window.getSelection()?.toString()) return;
                      jump(i);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && jump(i)}
                    className="cursor-pointer rounded-[14px] px-3.5 py-2.5 text-[17px] leading-7 select-text"
                    style={
                      i === current
                        ? { background: "var(--accent-wash)", color: "var(--ink)", fontWeight: 500 }
                        : { color: i < current ? "color-mix(in srgb, var(--ink) 55%, transparent)" : "var(--ink)" }
                    }
                  >
                    {timed && l.start >= 0 && (
                      <span className="mr-2 text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                        {formatTime(l.start)}
                      </span>
                    )}
                    <Highlighted text={l.text} saved={savedTexts} />
                  </div>
                  {sel && sel.line === i && (
                    <PhrasePopover
                      key={sel.text}
                      selection={sel}
                      lineText={l.text}
                      video={video}
                      onClose={() => setSel(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {phrases.length === 0 && (
                <li className="text-sm" style={{ color: "var(--muted)" }}>
                  Select words in the transcript to save your first phrase.
                </li>
              )}
              {phrases.map((p) => (
                <li key={p.id}>
                  <Link href={`/notebook/${p.id}`} className="card flex items-center justify-between gap-3 px-4 py-3 no-underline" style={{ color: "var(--ink)" }}>
                    <span className="font-medium">{p.text}</span>
                    <RegisterChip value={p.register} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {shadow && (
        <ShadowMode
          video={video}
          index={current}
          onIndex={(i) => setCurrent(i)}
          player={player}
          onExit={() => setShadow(false)}
        />
      )}
    </div>
  );
}

/** Show saved phrases inside a line with the butter highlight. */
function Highlighted({ text, saved }: { text: string; saved: string[] }) {
  if (!saved.length) return <>{text}</>;
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const s of saved) {
    if (s.length < 3) continue;
    let from = 0;
    let at: number;
    while ((at = lower.indexOf(s, from)) >= 0) {
      ranges.push([at, at + s.length]);
      from = at + s.length;
    }
  }
  if (!ranges.length) return <>{text}</>;
  ranges.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let i = 0;
  ranges.forEach(([a, b], k) => {
    if (a < i) return;
    if (a > i) out.push(text.slice(i, a));
    out.push(
      <mark key={k} className="rounded px-0.5" style={{ background: "var(--butter)", color: "inherit" }}>
        {text.slice(a, b)}
      </mark>,
    );
    i = b;
  });
  if (i < text.length) out.push(text.slice(i));
  return <>{out}</>;
}

function PhrasePopover({
  selection,
  lineText,
  video,
  onClose,
}: {
  selection: Selection;
  lineText: string;
  video: Video;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<PhraseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    callAi<PhraseInfo>("explain", { text: selection.text, context: lineText })
      .then((r) => live && setInfo(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [selection.text, lineText]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    const line = video.lines[selection.line];
    const id = await savePhrase({
      text: selection.text,
      source: {
        kind: "video",
        videoId: video.id,
        start: line.start,
        end: line.start >= 0 ? line.start + line.dur : -1,
        line: line.text,
      },
      dimensions: ["Expression", "Culture"],
      known: info ? { ...info, text: selection.text } : undefined,
      complete: Boolean(info),
      context: lineText,
    });
    setSavedId(id);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div
      role="dialog"
      aria-label={`Phrase: ${selection.text}`}
      className="rise mt-1.5 mb-2.5 flex flex-col gap-2.5 rounded-[20px] px-4 py-4 md:ml-3 md:px-5"
      style={{
        background: "var(--glass-strong)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[22px] font-semibold tracking-tight">{selection.text}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full" style={{ background: "var(--wash)" }}>
          ✕
        </button>
      </div>
      {!info && !error && (
        <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>
          Looking it up…
        </p>
      )}
      {error && (
        <p className="m-0 text-sm" style={{ color: "var(--danger)" }}>
          {error} You can still save it.
        </p>
      )}
      {info && (
        <>
          <p className="m-0 text-[15px] leading-6" style={{ color: "var(--ink-2)" }}>
            {info.meaning}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <RegisterChip value={info.register} />
            <CurrencyChip value={info.currency} />
            <span className="chip">Safe with {info.safeWith}</span>
          </div>
          {info.culture && (
            <p className="m-0 text-[13px] leading-5" style={{ color: "var(--muted)" }}>
              {info.culture}
            </p>
          )}
        </>
      )}
      <div className="flex items-center gap-2">
        {savedId ? (
          <>
            <span className="chip chip-casual">Saved</span>
            <Link href={`/notebook/${savedId}`} className="btn btn-ghost btn-sm">
              Open full card
            </Link>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>
            Save
          </button>
        )}
      </div>
    </div>
  );
}
