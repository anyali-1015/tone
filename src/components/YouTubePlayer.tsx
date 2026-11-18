"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/* Minimal typing for the YouTube IFrame Player API we use. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setRate(rate: number): void;
  time(): number;
  playing(): boolean;
}

export const YouTubePlayer = forwardRef<
  PlayerHandle,
  { videoId: string; onReady?: () => void; onPlayingChange?: (playing: boolean) => void }
>(function YouTubePlayer({ videoId, onReady, onPlayingChange }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const cbs = useRef({ onReady, onPlayingChange });
  useEffect(() => {
    cbs.current = { onReady, onPlayingChange };
  });

  useEffect(() => {
    let cancelled = false;
    const mount = document.createElement("div");
    host.current?.appendChild(mount);
    loadApi().then(() => {
      if (cancelled) return;
      player.current = new window.YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0 },
        events: {
          onReady: () => cbs.current.onReady?.(),
          onStateChange: (e: { data: number }) => cbs.current.onPlayingChange?.(e.data === 1),
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      mount.remove();
    };
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    play: () => player.current?.playVideo(),
    pause: () => player.current?.pauseVideo(),
    seek: (s) => player.current?.seekTo(Math.max(0, s), true),
    setRate: (r) => player.current?.setPlaybackRate(r),
    time: () => player.current?.getCurrentTime?.() ?? 0,
    playing: () => player.current?.getPlayerState?.() === 1,
  }));

  return <div ref={host} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />;
});
