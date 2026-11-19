"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useState } from "react";
import { RegisterChip } from "@/components/chips";
import { IconCheck, IconPlus } from "@/components/icons";
import { db } from "@/lib/db";
import { savePhrase } from "@/lib/phrases";
import { getScene } from "@/lib/scenes";
import { updateSettings, useSettings } from "@/lib/settings";
import { speak, useVoices } from "@/lib/speech";

export default function ScenePrepPage() {
  return (
    <Suspense fallback={null}>
      <ScenePrepPageInner />
    </Suspense>
  );
}

function ScenePrepPageInner() {
  const { id } = useParams<{ id: string }>();
  const scene = getScene(id);
  const settings = useSettings();
  const voices = useVoices();
  const [pinned, setPinned] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const [progress, phrases] = await Promise.all([db.sceneProgress.get(id), db.phrases.toArray()]);
    return { covered: progress?.covered ?? [], saved: new Set(phrases.map((p) => p.text.toLowerCase())) };
  }, [id]);

  if (!scene) {
    return (
      <p>
        Scene not found. <Link href="/talk">Back to Talk</Link>
      </p>
    );
  }
  const covered = data?.covered ?? [];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/talk" className="text-sm no-underline" style={{ color: "var(--muted)" }}>
          ‹ Talk
        </Link>
        <h1 className="m-0 text-[32px] leading-10 font-semibold tracking-tight">{scene.title}</h1>
        <p className="m-0 text-[17px] leading-7" style={{ color: "var(--ink-2)" }}>
          {scene.goal} You&apos;ll talk with {scene.partnerName}, the {scene.partner.toLowerCase()}.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow m-0">The unspoken rules</h2>
        <ul className="m-0 flex flex-col gap-2 pl-5 text-[16px] leading-[26px]">
          {scene.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow m-0">Key shorthand</h2>
        <div className="card flex flex-col">
          {scene.keyPhrases.map((k, i) => {
            const isSaved = data?.saved.has(k.text.toLowerCase());
            return (
              <div
                key={k.text}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
                style={i ? { borderTop: "1px solid var(--hairline)" } : undefined}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] font-semibold">{k.text}</span>
                  <span className="text-[13px] line-through" style={{ color: "var(--muted)", textDecorationColor: "var(--hairline-2)" }}>
                    {k.longVersion}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <RegisterChip value={k.register} />
                  <button
                    type="button"
                    className="btn btn-sm h-9 w-9 p-0"
                    aria-label={isSaved ? `${k.text} saved` : `Save ${k.text}`}
                    disabled={isSaved}
                    onClick={() =>
                      savePhrase({
                        text: k.text,
                        source: { kind: "scene", sceneId: scene.id },
                        dimensions: ["Expression", "Interaction"],
                        known: { register: k.register, longVersion: k.longVersion },
                        context: `${scene.title}: ${scene.goal}`,
                      })
                    }
                  >
                    {isSaved ? <IconCheck size={16} /> : <IconPlus size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="eyebrow m-0">Situations</h2>
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            {covered.length} of {scene.twists.length} practiced · tap one to practice it next
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {scene.twists.map((t) => {
            const done = covered.includes(t.id);
            const isPinned = pinned === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isPinned}
                onClick={() => setPinned(isPinned ? null : t.id)}
                className="btn btn-sm"
                style={
                  isPinned
                    ? { background: "var(--accent-wash)", color: "var(--accent)", borderColor: "transparent" }
                    : done
                      ? { color: "var(--mint-ink)", background: "var(--mint)", borderColor: "transparent" }
                      : undefined
                }
              >
                {done && <IconCheck size={14} />}
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-4">
        <label htmlFor="scene-voice" className="text-[15px] font-medium">
          Voice
        </label>
        <select
          id="scene-voice"
          className="input max-w-[220px]"
          value={settings.voiceURI ?? ""}
          onChange={(e) => {
            updateSettings({ voiceURI: e.target.value || null });
            speak(scene.opening);
          }}
        >
          <option value="">Best available</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="Speed">
          <button type="button" aria-pressed={settings.speechRate === 1} onClick={() => updateSettings({ speechRate: 1 })}>
            Natural
          </button>
          <button type="button" aria-pressed={settings.speechRate !== 1} onClick={() => updateSettings({ speechRate: 0.88 })}>
            A bit slower
          </button>
        </div>
      </section>

      <div className="flex justify-end">
        <Link href={`/talk/live?scene=${scene.id}${pinned ? `&pin=${pinned}` : ""}`} className="btn btn-primary min-h-12 px-7 text-base">
          Start conversation
        </Link>
      </div>
    </div>
  );
}
