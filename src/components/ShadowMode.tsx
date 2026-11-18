"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db, logActivity, uid } from "@/lib/db";
import { markReductions } from "@/lib/reductions";
import { useSettings } from "@/lib/settings";
import type { Video } from "@/lib/types";
import { IconClose, IconMic, IconNext, IconPlay, IconPrev } from "./icons";
import type { PlayerHandle } from "./YouTubePlayer";

interface Take {
  line: number;
  blob: Blob;
  url: string;
}

type Step = "listen" | "say" | "compare";

export function ShadowMode({
  video,
  index,
  onIndex,
  player,
  onExit,
}: {
  video: Video;
  index: number;
  onIndex: (i: number) => void;
  player: React.RefObject<PlayerHandle | null>;
  onExit: () => void;
}) {
  const settings = useSettings();
  const line = video.lines[index];
  const start = Math.max(0, line.start);
  const end = line.start >= 0 ? line.start + Math.max(1, line.dur) + 0.25 : -1;

  const [stepState, setStepState] = useState<{ index: number; step: Step }>({ index, step: "listen" });
  const step: Step = stepState.index === index ? stepState.step : "listen";
  const setStep = useCallback((s: Step) => setStepState({ index, step: s }), [index]);
  const [loop, setLoop] = useState(false);
  const [recording, setRecording] = useState(false);
  const [takes, setTakes] = useState<Take[]>([]);
  const [askKeep, setAskKeep] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const enteredAt = useRef(0);
  useEffect(() => {
    enteredAt.current = Date.now();
  }, []);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const takeCanvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<number | null>(null);

  const take = [...takes].reverse().find((t) => t.line === index);

  /* ---- Listen: play just this line (optionally on loop) ---- */
  function playLine(repeat: boolean) {
    const p = player.current;
    if (!p || line.start < 0) return;
    if (stopTimer.current) window.clearInterval(stopTimer.current);
    p.seek(start);
    p.play();
    stopTimer.current = window.setInterval(() => {
      if (p.time() >= end) {
        if (repeat) p.seek(start);
        else {
          p.pause();
          if (stopTimer.current) window.clearInterval(stopTimer.current);
        }
      }
    }, 80);
  }
  const playRef = useRef(playLine);
  useEffect(() => {
    playRef.current = playLine;
  });

  useEffect(() => {
    playRef.current(false);
    return () => {
      if (stopTimer.current) window.clearInterval(stopTimer.current);
    };
  }, [index]);

  /* ---- Say it: record with a live waveform ---- */
  const startRec = useCallback(async () => {
    if (recorder.current) return;
    player.current?.pause();
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setTakes((ts) => [...ts, { line: index, blob, url: URL.createObjectURL(blob) }]);
        setStep("compare");
        void db.videos.get(video.id).then((v) => {
          if (v && !v.shadowedLines.includes(index)) db.videos.update(video.id, { shadowedLines: [...v.shadowedLines, index] });
        });
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setStep("say");
      const buf = new Uint8Array(analyser.fftSize);
      const draw = () => {
        if (!recorder.current) return;
        analyser.getByteTimeDomainData(buf);
        drawWave(liveCanvas.current, buf);
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    } catch {
      setMicError("Microphone access is blocked. Allow it in Chrome's address bar to record.");
    }
  }, [index, player, video.id, setStep]);

  const stopRec = useCallback(() => {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }, []);

  /* ---- Compare: draw your take ---- */
  useEffect(() => {
    if (!take || !takeCanvas.current) return;
    let cancelled = false;
    take.blob.arrayBuffer().then(async (ab) => {
      const ctx = new AudioContext();
      try {
        const audioBuf = await ctx.decodeAudioData(ab);
        if (!cancelled) drawPeaks(takeCanvas.current, audioBuf.getChannelData(0));
      } catch {
        /* undecodable: skip drawing */
      } finally {
        void ctx.close();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [take, step]);

  function playYours() {
    if (!take) return;
    player.current?.pause();
    audio.current?.pause();
    audio.current = new Audio(take.url);
    void audio.current.play();
  }

  /* ---- Exit ---- */
  const exit = useCallback(() => {
    if (recorder.current) stopRec();
    if (stopTimer.current) window.clearInterval(stopTimer.current);
    void logActivity("Accent", (Date.now() - enteredAt.current) / 1000);
    if (takes.length && settings.recordings === "ask") setAskKeep(true);
    else onExit();
  }, [takes.length, settings.recordings, onExit, stopRec]);

  async function finish(keep: boolean) {
    if (keep) {
      await db.recordings.bulkAdd(
        takes.map((t) => ({ id: uid(), videoId: video.id, line: t.line, blob: t.blob, createdAt: Date.now() })),
      );
    }
    takes.forEach((t) => URL.revokeObjectURL(t.url));
    onExit();
  }

  /* ---- Keyboard: R hold-to-record, ←/→ lines, Space replay, Esc exit ---- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (askKeep) return;
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      } else if ((e.key === "r" || e.key === "R") && !e.repeat) {
        e.preventDefault();
        void startRec();
      } else if (e.key === "ArrowRight" && index < video.lines.length - 1) {
        e.preventDefault();
        onIndex(index + 1);
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        onIndex(index - 1);
      } else if (e.key === " ") {
        e.preventDefault();
        playRef.current(loop);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") stopRec();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, [askKeep, exit, index, loop, onIndex, startRec, stopRec, video.lines.length]);

  const pieces = markReductions(line.text);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shadow mode"
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
    >
      <header className="flex items-center justify-between px-7 py-4">
        <div className="flex items-center gap-3">
          <button type="button" className="btn h-11 w-11 p-0" aria-label="Exit shadow mode" onClick={exit}>
            <IconClose size={18} />
          </button>
          <div>
            <p className="m-0 text-xs" style={{ color: "var(--muted)" }}>
              Shadow mode
            </p>
            <p className="m-0 text-[15px] font-semibold">
              Line {index + 1} of {video.lines.length}
            </p>
          </div>
        </div>
        <ol className="m-0 flex list-none items-center gap-2 p-0 text-sm" aria-label="Steps">
          {(["listen", "say", "compare"] as Step[]).map((s, i) => (
            <li
              key={s}
              className="rounded-full px-3 py-1.5"
              aria-current={step === s ? "step" : undefined}
              style={step === s ? { background: "var(--accent-wash)", color: "var(--accent)", fontWeight: 600 } : { color: "var(--muted)" }}
            >
              {i + 1}. {s === "listen" ? "Listen" : s === "say" ? "Say it" : "Compare"}
            </li>
          ))}
        </ol>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-10">
        <div className="flex w-full max-w-[900px] items-center gap-6">
          <button type="button" className="btn h-12 w-12 shrink-0 p-0" aria-label="Previous line" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <IconPrev />
          </button>
          <p className="m-0 flex-1 text-center text-[34px] leading-[48px] font-medium tracking-tight">
            {pieces.map((p, i) =>
              p.sounds ? (
                <span key={i} className="relative inline-block" title={p.sounds === "reduced" ? "reduced in speech" : `sounds like “${p.sounds}”`}>
                  <span style={{ borderBottom: "2px dotted var(--accent)" }}>{p.text}</span>
                  {p.sounds !== "reduced" && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[13px] font-normal whitespace-nowrap italic" style={{ color: "var(--accent)" }}>
                      {p.sounds}
                    </span>
                  )}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
          <button
            type="button"
            className="btn h-12 w-12 shrink-0 p-0"
            aria-label="Next line"
            disabled={index >= video.lines.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            <IconNext />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="btn min-h-12" onClick={() => playLine(loop)} disabled={line.start < 0}>
            <IconPlay size={16} /> Listen
          </button>
          <button type="button" className="btn min-h-12" aria-pressed={loop} onClick={() => setLoop((l) => !l)} style={loop ? { background: "var(--accent-wash)" } : undefined}>
            Loop
          </button>
          <button
            type="button"
            className={`btn btn-primary min-h-14 px-7 text-base ${recording ? "listening" : ""}`}
            onMouseDown={() => void startRec()}
            onMouseUp={stopRec}
            onMouseLeave={() => recording && stopRec()}
          >
            <IconMic size={20} /> {recording ? "Recording… release to stop" : "Hold to record (R)"}
          </button>
        </div>
        {line.start < 0 && (
          <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>
            This transcript has no timestamps, so Listen can&apos;t jump to the line. Play the video yourself, then record.
          </p>
        )}
        {micError && (
          <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>
            {micError}
          </p>
        )}

        <div className="flex w-full max-w-[720px] flex-col gap-3">
          {recording && <canvas ref={liveCanvas} width={1440} height={120} className="h-[60px] w-full" aria-label="Live waveform" />}
          {take && !recording && (
            <div className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Compare</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  YouTube&apos;s audio can&apos;t be captured, so only your take is drawn.
                </span>
              </div>
              <canvas ref={takeCanvas} width={1440} height={120} className="h-[60px] w-full" aria-label="Your recording" />
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm" onClick={() => playLine(false)} disabled={line.start < 0}>
                  Play original
                </button>
                <button type="button" className="btn btn-sm" onClick={playYours}>
                  Play yours
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="px-7 py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>
        Space replay · hold R to record · ← → lines · Esc exit
      </footer>

      {askKeep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,20,24,0.18)" }}>
          <div role="alertdialog" aria-label="Keep these recordings?" className="glass rise flex w-[400px] flex-col gap-4 rounded-3xl p-6" style={{ boxShadow: "var(--shadow-lg)" }}>
            <h2 className="m-0 text-lg font-semibold">Keep these recordings?</h2>
            <p className="m-0 text-sm" style={{ color: "var(--ink-2)" }}>
              {takes.length} take{takes.length === 1 ? "" : "s"} from this session. Discarding saves space.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => finish(true)}>
                Keep
              </button>
              <button type="button" className="btn btn-primary" autoFocus onClick={() => finish(false)}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function colors() {
  const cs = getComputedStyle(document.documentElement);
  return { accent: cs.getPropertyValue("--accent").trim() || "#3d5afe" };
}

function drawWave(canvas: HTMLCanvasElement | null, buf: Uint8Array) {
  if (!canvas) return;
  const g = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = colors().accent;
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const x = (i / buf.length) * w;
    const y = (buf[i] / 255) * h;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

function drawPeaks(canvas: HTMLCanvasElement | null, data: Float32Array) {
  if (!canvas) return;
  const g = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  g.fillStyle = colors().accent;
  const bars = 180;
  const step = Math.floor(data.length / bars) || 1;
  for (let b = 0; b < bars; b++) {
    let peak = 0;
    for (let i = b * step; i < (b + 1) * step && i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    const bh = Math.max(3, peak * h);
    g.fillRect((b / bars) * w, (h - bh) / 2, (w / bars) * 0.6, bh);
  }
}
