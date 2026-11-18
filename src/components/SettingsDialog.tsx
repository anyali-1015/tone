"use client";

import { useEffect, useRef, useState } from "react";
import { exportAll, importAll } from "@/lib/db";
import { updateSettings, useSettings } from "@/lib/settings";
import { speak, useVoices } from "@/lib/speech";
import { Modal } from "./Modal";

interface Status {
  ai: { provider: string; model: string; ready: boolean };
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const voices = useVoices();
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function doExport() {
    const blob = await exportAll();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tone-notebook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doImport(file: File) {
    try {
      const n = await importAll(file);
      setMsg(`Imported ${n} phrases.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <Modal label="Settings" onClose={onClose} width={560}>
      <div className="flex flex-col gap-6 p-7">
        <h2 className="m-0 text-[22px] font-semibold">Settings</h2>

        <Row label="AI">
          {status ? (
            status.ai.ready ? (
              <span className="text-sm">
                {status.ai.provider === "gemini" ? "Google Gemini" : "OpenAI-compatible"} · {status.ai.model}
              </span>
            ) : (
              <span className="text-sm" style={{ color: "var(--danger)" }}>
                No key yet — add {status.ai.provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} to .env.local
              </span>
            )
          ) : (
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              Checking…
            </span>
          )}
        </Row>

        <Row label="AI voice" htmlFor="voice">
          <div className="flex items-center gap-2">
            <select
              id="voice"
              className="input max-w-[260px]"
              value={s.voiceURI ?? ""}
              onChange={(e) => updateSettings({ voiceURI: e.target.value || null })}
            >
              <option value="">Best available</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => speak("Hey! What can I get started for you?")}
            >
              Test
            </button>
          </div>
        </Row>

        <Row label="AI speaking speed">
          <div className="seg" role="group" aria-label="AI speaking speed">
            {[
              { v: 1, l: "Natural" },
              { v: 0.88, l: "A bit slower" },
            ].map((o) => (
              <button key={o.v} type="button" aria-pressed={s.speechRate === o.v} onClick={() => updateSettings({ speechRate: o.v })}>
                {o.l}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Daily review size">
          <div className="seg" role="group" aria-label="Daily review size">
            {[10, 15, 20].map((n) => (
              <button key={n} type="button" aria-pressed={s.reviewSize === n} onClick={() => updateSettings({ reviewSize: n })}>
                {n}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Video speed">
          <div className="seg" role="group" aria-label="Default video speed">
            {[0.75, 1].map((n) => (
              <button key={n} type="button" aria-pressed={s.defaultSpeed === n} onClick={() => updateSettings({ defaultSpeed: n })}>
                {n === 1 ? "1.0×" : `${n}×`}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Recordings">
          <div className="seg" role="group" aria-label="Recordings">
            <button type="button" aria-pressed={s.recordings === "ask"} onClick={() => updateSettings({ recordings: "ask" })}>
              Ask each time
            </button>
            <button type="button" aria-pressed={s.recordings === "discard"} onClick={() => updateSettings({ recordings: "discard" })}>
              Always discard
            </button>
          </div>
        </Row>

        <Row label="Appearance">
          <div className="seg" role="group" aria-label="Appearance">
            {(
              [
                ["light", "Light"],
                ["dark", "Dusk"],
                ["auto", "Auto"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={s.theme === v} onClick={() => updateSettings({ theme: v })}>
                {l}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Notebook backup">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={doExport}>
              Export
            </button>
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </div>
        </Row>
        {msg && (
          <p role="status" className="m-0 text-sm" style={{ color: "var(--muted)" }}>
            {msg}
          </p>
        )}
        <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
          Everything is stored in this browser. Export a backup now and then — clearing browser data clears the notebook.
        </p>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-[15px] font-medium">
          {label}
        </label>
      ) : (
        <span className="text-[15px] font-medium">{label}</span>
      )}
      {children}
    </div>
  );
}
