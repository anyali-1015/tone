"use client";

import { useSyncExternalStore } from "react";

export interface Settings {
  voiceURI: string | null; // AI voice (browser built-in)
  speechRate: number; // 0.85 = "a bit slower", 1 = natural
  reviewSize: number;
  defaultSpeed: number; // video playback
  recordings: "ask" | "discard";
  theme: "auto" | "light" | "dark";
}

const DEFAULTS: Settings = {
  voiceURI: null,
  speechRate: 1,
  reviewSize: 15,
  defaultSpeed: 1,
  recordings: "ask",
  theme: "auto",
};

const KEY = "tone.settings";
const listeners = new Set<() => void>();
let cache: Settings | null = null;

function read(): Settings {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache!;
}

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  return read();
}

export function updateSettings(patch: Partial<Settings>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: keep in memory */
  }
  applyTheme(cache.theme);
  listeners.forEach((l) => l());
}

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSettings,
    () => DEFAULTS,
  );
}
