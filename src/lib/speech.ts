"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings } from "./settings";

/* ---------------- Text to speech: the browser's built-in American voices (v1) ---------------- */

const PREFERRED = [
  "Samantha", // macOS
  "Ava",
  "Allison",
  "Nicky",
  "Aaron",
  "Evan",
  "Joelle",
  "Google US English",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Microsoft Guy",
];

export function usVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => /^en[-_]US$/i.test(v.lang));
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(usVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

function bestVoice(): SpeechSynthesisVoice | undefined {
  const voices = usVoices();
  const chosen = getSettings().voiceURI;
  if (chosen) {
    const v = voices.find((x) => x.voiceURI === chosen);
    if (v) return v;
  }
  for (const name of PREFERRED) {
    const v = voices.find((x) => x.name.includes(name) && !/compact/i.test(x.name));
    if (v) return v;
  }
  return voices[0];
}

export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice();
  if (v) u.voice = v;
  u.lang = "en-US";
  u.rate = opts.rate ?? getSettings().speechRate;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* ---------------- Speech to text: Chrome's built-in recognizer (v1) ---------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

export function recognitionSupported() {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Hold-to-talk dictation. start() begins listening; stop() ends it and resolves with
 * the final transcript. `interim` streams what's been heard so far.
 */
export function useDictation() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition>(null);
  const finalText = useRef("");
  const interimRef = useRef("");
  const resolver = useRef<((t: string) => void) | null>(null);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input needs Chrome. You can type instead.");
      return;
    }
    if (rec.current) return;
    stopSpeaking();
    finalText.current = "";
    interimRef.current = "";
    setInterim("");
    setError(null);
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let fin = "";
      let mid = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else mid += t;
      }
      finalText.current = fin;
      interimRef.current = (fin + " " + mid).trim();
      setInterim(interimRef.current);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === "not-allowed") setError("Microphone access is blocked. Allow it in Chrome's address bar.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("Couldn't hear that. Try again or type.");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      const text = (finalText.current || "").trim();
      resolver.current?.(text);
      resolver.current = null;
    };
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  const stop = useCallback(
    () =>
      new Promise<string>((resolve) => {
        if (!rec.current) {
          resolve(finalText.current.trim());
          return;
        }
        resolver.current = (t) => resolve(t || interimRef.current);
        rec.current.stop();
      }),
    [],
  );

  return { listening, interim, error, start, stop, setInterim };
}
