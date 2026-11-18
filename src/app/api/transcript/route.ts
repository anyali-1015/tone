import type { NextRequest } from "next/server";
import { mergeFragments } from "@/lib/captions";
import type { CaptionLine } from "@/lib/types";

/**
 * Loads a YouTube video's title and English captions as timed lines (spec §8).
 * We only read captions; the video itself is always streamed by YouTube's own player.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface Track {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("v") ?? "";
  if (!/^[\w-]{11}$/.test(id)) {
    return Response.json({ error: "That doesn't look like a YouTube link." }, { status: 400 });
  }

  const meta = await fetchMeta(id);
  let lines: CaptionLine[] = [];
  let auto = false;
  let error: string | null = null;
  try {
    const tracks = (await tracksFromWatchPage(id)) ?? (await tracksFromPlayerApi(id)) ?? [];
    const track = chooseTrack(tracks);
    if (!track) {
      error = "This video has no English captions.";
    } else {
      auto = track.kind === "asr";
      lines = await fetchTrack(track.baseUrl);
      if (!lines.length) error = "YouTube didn't return the captions for this video.";
    }
  } catch {
    error = "Couldn't reach YouTube's captions for this video.";
  }

  if (auto || lines.some((l) => l.text.split(" ").length < 4)) lines = mergeFragments(lines);

  return Response.json({
    youtubeId: id,
    title: meta.title,
    channel: meta.channel,
    lines,
    auto,
    error,
  });
}

async function fetchMeta(id: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (res.ok) {
      const j = await res.json();
      return { title: String(j.title ?? "Untitled video"), channel: String(j.author_name ?? "") };
    }
  } catch {
    /* fall through */
  }
  return { title: "Untitled video", channel: "" };
}

function extractTracks(json: unknown): Track[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks = (json as any)?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(tracks) && tracks.length ? (tracks as Track[]) : null;
}

async function tracksFromWatchPage(id: string): Promise<Track[] | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+1" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const marker = "ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const end = html.indexOf(";</script>", jsonStart);
  if (end < 0) return null;
  try {
    return extractTracks(JSON.parse(html.slice(jsonStart, end)));
  } catch {
    return null;
  }
}

async function tracksFromPlayerApi(id: string): Promise<Track[] | null> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      videoId: id,
      context: { client: { clientName: "WEB", clientVersion: "2.20241120.01.00", hl: "en" } },
    }),
  });
  if (!res.ok) return null;
  return extractTracks(await res.json());
}

function chooseTrack(tracks: Track[]): Track | undefined {
  const en = tracks.filter((t) => t.languageCode?.toLowerCase().startsWith("en"));
  return (
    en.find((t) => t.kind !== "asr" && /en-us/i.test(t.languageCode)) ??
    en.find((t) => t.kind !== "asr") ??
    en.find((t) => t.kind === "asr")
  );
}

async function fetchTrack(baseUrl: string): Promise<CaptionLine[]> {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", "json3");
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const body = await res.text();
  if (!body.trim()) return [];
  if (body.trim().startsWith("{")) {
    const data = JSON.parse(body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.events ?? []).flatMap((e: any) => {
      if (!e.segs) return [];
      const text = decode(e.segs.map((s: { utf8?: string }) => s.utf8 ?? "").join("")).replace(/\s+/g, " ").trim();
      if (!text) return [];
      return [{ start: (e.tStartMs ?? 0) / 1000, dur: (e.dDurationMs ?? 0) / 1000, text }];
    });
  }
  // XML fallback: <text start="1.2" dur="3.4">…</text>
  return [...body.matchAll(/<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => ({
      start: Number(m[1]),
      dur: Number(m[2] ?? 3),
      text: decode(m[3].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
    }))
    .filter((l) => l.text);
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
