import type { CaptionLine } from "./types";

/** Pull an 11-character YouTube id out of any common link shape (or a bare id). */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

const TIME = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;

function stampSeconds(stamp: string): number | null {
  const parts = stamp.trim().split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * Parse a transcript pasted by hand — e.g. copied from YouTube's "Show transcript" panel,
 * where timestamps sit on their own line or at the start of a line. Lines without any
 * timestamps get start = -1 (no sync with the video).
 */
export function parsePastedTranscript(text: string): CaptionLine[] {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  const out: CaptionLine[] = [];
  let pendingStart: number | null = null;
  for (const row of rows) {
    if (TIME.test(row)) {
      pendingStart = stampSeconds(row);
      continue;
    }
    const inline = row.match(/^\[?((?:\d+:)?\d{1,2}:\d{2})\]?\s+(.+)$/);
    if (inline) {
      out.push({ start: stampSeconds(inline[1]) ?? -1, dur: 0, text: inline[2] });
      pendingStart = null;
      continue;
    }
    out.push({ start: pendingStart ?? -1, dur: 0, text: row });
    pendingStart = null;
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    if (out[i].start >= 0) out[i].dur = next && next.start > out[i].start ? next.start - out[i].start : 4;
  }
  return mergeFragments(out);
}

/**
 * Auto-generated captions arrive as 2–5 word fragments. Merge them into readable lines
 * that end at sentence punctuation, a pause, or ~16 words.
 */
export function mergeFragments(lines: CaptionLine[]): CaptionLine[] {
  const out: CaptionLine[] = [];
  let cur: CaptionLine | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const text = l.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (!cur) {
      cur = { ...l, text };
    } else {
      cur.text = `${cur.text} ${text}`;
      if (l.start >= 0 && cur.start >= 0) cur.dur = l.start + l.dur - cur.start;
    }
    const words = cur.text.split(" ").length;
    const endsSentence = /[.!?…]["')\]]?$/.test(cur.text);
    const next = lines[i + 1];
    const pause =
      next && next.start >= 0 && cur.start >= 0 ? next.start - (cur.start + cur.dur) > 0.9 : false;
    if ((endsSentence && words >= 3) || words >= 16 || (pause && words >= 4)) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function formatTime(sec: number): string {
  if (sec < 0 || !Number.isFinite(sec)) return "";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
