"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { parsePastedTranscript, parseYouTubeId } from "@/lib/captions";
import { db, uid } from "@/lib/db";
import type { CaptionLine, Video } from "@/lib/types";

type Sort = "recent" | "progress" | "finished";

interface Pending {
  youtubeId: string;
  title: string;
  channel: string;
  reason: string;
}

export default function WatchPage() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pasted, setPasted] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const data = useLiveQuery(async () => {
    const [videos, phrases] = await Promise.all([db.videos.orderBy("updatedAt").reverse().toArray(), db.phrases.toArray()]);
    const counts: Record<string, number> = {};
    for (const p of phrases) if (p.source.kind === "video") counts[p.source.videoId] = (counts[p.source.videoId] ?? 0) + 1;
    return { videos, counts };
  }, []);

  async function create(meta: { youtubeId: string; title: string; channel: string }, lines: CaptionLine[]) {
    const existing = await db.videos.where("youtubeId").equals(meta.youtubeId).first();
    const now = Date.now();
    const video: Video = existing
      ? { ...existing, lines, updatedAt: now }
      : { id: uid(), ...meta, lines, currentLine: 0, shadowedLines: [], createdAt: now, updatedAt: now };
    await db.videos.put(video);
    router.push(`/watch/${video.id}`);
  }

  async function add(value = link) {
    const id = parseYouTubeId(value);
    if (!id) {
      setError("That doesn't look like a YouTube link.");
      return;
    }
    const existing = await db.videos.where("youtubeId").equals(id).first();
    if (existing?.lines.length) {
      router.push(`/watch/${existing.id}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transcript?v=${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load that video.");
      if (j.lines?.length) {
        await create({ youtubeId: id, title: j.title, channel: j.channel }, j.lines);
      } else {
        setPending({ youtubeId: id, title: j.title, channel: j.channel, reason: j.error || "No captions came back." });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applyPasted() {
    if (!pending) return;
    const lines = parsePastedTranscript(pasted);
    if (!lines.length) return;
    await create(pending, lines);
  }

  const videos = (data?.videos ?? []).filter((v) => {
    const done = v.lines.length > 0 && v.currentLine >= v.lines.length - 1;
    if (sort === "finished") return done;
    if (sort === "progress") return !done && v.currentLine > 0;
    return true;
  });

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[32px] leading-10 font-semibold tracking-tight">Watch</h1>
        <p className="m-0 text-[15px]" style={{ color: "var(--muted)" }}>
          Real speech in. Shadow it line by line and save what natives say.
        </p>
      </header>

      <form
        className="glass flex flex-wrap items-center gap-3 rounded-[20px] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label htmlFor="yt" className="sr-only">
          YouTube link
        </label>
        <input
          id="yt"
          className="input min-w-[240px] flex-1 border-0 bg-transparent"
          placeholder="Paste a YouTube link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text");
            if (parseYouTubeId(v)) {
              e.preventDefault();
              setLink(v);
              void add(v);
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !link.trim()}>
          {busy ? "Loading captions…" : "Add"}
        </button>
      </form>
      {error && (
        <p role="alert" className="-mt-4 m-0 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {pending && (
        <section className="card rise flex flex-col gap-3 p-6">
          <p className="eyebrow m-0">Captions needed</p>
          <h2 className="m-0 text-lg font-semibold">{pending.title}</h2>
          <p className="m-0 text-[15px]" style={{ color: "var(--ink-2)" }}>
            {pending.reason} You can paste the transcript instead: on YouTube, open the video&apos;s description, click
            <strong> Show transcript</strong>, select all of it and paste it here. Timestamps are kept, so lines stay in
            sync with the video.
          </p>
          <label htmlFor="pasted" className="sr-only">
            Transcript
          </label>
          <textarea id="pasted" rows={7} className="input text-[15px]" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"0:00\nOkay, so it's been a long day.\n0:03\nI'm gonna grab a coffee real quick…"} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={applyPasted} disabled={!pasted.trim()}>
              Use this transcript
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {data && data.videos.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="eyebrow m-0">Your videos</h2>
          <div className="seg" role="group" aria-label="Sort videos">
            {(
              [
                ["recent", "Recent"],
                ["progress", "In progress"],
                ["finished", "Finished"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={sort === v} onClick={() => setSort(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {data && data.videos.length === 0 && !pending && (
        <p className="m-0 text-[15px]" style={{ color: "var(--muted)" }}>
          No videos yet. Vlogs, street interviews and podcasts-on-YouTube with real conversation work best.
        </p>
      )}

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {videos.map((v) => {
          const pct = v.lines.length ? Math.round(((v.currentLine + 1) / v.lines.length) * 100) : 0;
          return (
            <Link key={v.id} href={`/watch/${v.id}`} className="card flex flex-col overflow-hidden no-underline" style={{ color: "var(--ink)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`} alt="" className="aspect-video w-full object-cover" style={{ background: "var(--wash)" }} onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              <div className="flex flex-col gap-1 p-4">
                <p className="m-0 line-clamp-2 text-[15px] leading-[22px] font-semibold">{v.title}</p>
                <p className="m-0 truncate text-[13px]" style={{ color: "var(--muted)" }}>
                  {v.channel}
                </p>
                <div className="mt-2 flex items-center justify-between text-[13px]" style={{ color: "var(--muted)" }}>
                  <span>{pct}% watched</span>
                  <span>
                    {data?.counts[v.id] ?? 0} phrase{(data?.counts[v.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
