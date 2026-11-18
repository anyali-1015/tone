"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useState } from "react";
import { CurrencyChip, RegisterChip, TypeChip } from "@/components/chips";
import { IconSpeaker, IconTrash } from "@/components/icons";
import { db } from "@/lib/db";
import { enrichPhrase, sourceLabel } from "@/lib/phrases";
import { getScene } from "@/lib/scenes";
import { speak } from "@/lib/speech";
import type { Phrase } from "@/lib/types";

export default function PhraseCardPage() {
  return (
    <Suspense fallback={null}>
      <PhraseCardPageInner />
    </Suspense>
  );
}

function PhraseCardPageInner() {
  const { id } = useParams<{ id: string }>();
  const data = useLiveQuery(async () => {
    const [phrase, lists] = await Promise.all([db.phrases.get(id), db.lists.toArray()]);
    let video = null;
    if (phrase?.source.kind === "video") video = (await db.videos.get(phrase.source.videoId)) ?? null;
    return { phrase: phrase ?? null, lists, video };
  }, [id]);

  if (!data) return null;
  if (!data.phrase) {
    return (
      <p>
        This phrase isn&apos;t in your Notebook. <Link href="/notebook">Back to Notebook</Link>
      </p>
    );
  }
  return <Card phrase={data.phrase} lists={data.lists} videoId={data.video?.id} />;
}

function Card({ phrase: p, lists, videoId }: { phrase: Phrase; lists: { id: string; name: string }[]; videoId?: string }) {
  const router = useRouter();
  const [note, setNote] = useState(p.note);
  const [retrying, setRetrying] = useState(false);
  const [usedRecently, setUsedRecently] = useState(false);

  const sceneId = p.source.kind === "scene" ? p.source.sceneId : p.source.kind === "talk" ? p.source.sceneId : undefined;
  const scene = getScene(sceneId);
  const created = new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  async function markUsed() {
    await db.phrases.update(p.id, { usedCount: p.usedCount + 1, usedAt: Date.now() });
    setUsedRecently(true);
  }

  async function remove() {
    if (!confirm(`Delete “${p.text}” from your Notebook?`)) return;
    await db.phrases.delete(p.id);
    router.push("/notebook");
  }

  async function retry() {
    setRetrying(true);
    await enrichPhrase(p.id, p.source.kind === "video" ? p.source.line : p.longVersion);
    setRetrying(false);
  }

  return (
    <article className="mx-auto flex max-w-[680px] flex-col gap-7 pb-10">
      <Link href="/notebook" className="text-sm no-underline" style={{ color: "var(--muted)" }}>
        ‹ Notebook
      </Link>

      <header className="flex flex-col gap-3.5">
        <div className="flex items-center gap-4">
          <h1 className="m-0 text-[40px] leading-[48px] font-semibold tracking-tight">{p.text}</h1>
          <button
            type="button"
            aria-label="Hear it"
            onClick={() => speak(p.text)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
          >
            <IconSpeaker size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <TypeChip value={p.type} />
          <RegisterChip value={p.register} />
          <CurrencyChip value={p.currency} />
          <span className="chip">Safe with {p.safeWith}</span>
          {p.dimensions.map((d) => (
            <span key={d} className="chip chip-accent">
              {d}
            </span>
          ))}
        </div>
        <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
          {sourceLabel(p)}
          {scene ? ` · ${scene.title}` : ""} · {created}
          {p.usedCount > 0 && ` · used in real life ${p.usedCount}×`}
        </p>
      </header>

      {!p.enriched && (
        <div className="card flex items-center justify-between gap-3 p-4">
          <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>
            {retrying ? "Filling in the card…" : "The full explanation isn't here yet."}
          </p>
          <button type="button" className="btn btn-sm" onClick={retry} disabled={retrying}>
            Fill it in
          </button>
        </div>
      )}

      {p.longVersion && (
        <section className="card flex flex-col gap-1.5 px-6 py-5">
          <h2 className="eyebrow m-0">The long way to say it</h2>
          <p className="m-0 text-[17px] leading-7 line-through" style={{ color: "var(--muted)", textDecorationColor: "var(--hairline-2)" }}>
            “{p.longVersion}”
          </p>
          <p className="m-0 text-[17px] leading-7 font-semibold">“{p.text}”</p>
        </section>
      )}

      {p.meaning && (
        <Section title="Meaning">
          <p className="m-0 text-[17px] leading-7">{p.meaning}</p>
        </Section>
      )}

      {p.examples.length > 0 && (
        <Section title="How natives use it">
          <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[17px] leading-7">
            {p.examples.map((e) => (
              <li key={e}>
                <button type="button" className="text-left" onClick={() => speak(e)} title="Hear it">
                  “{e}”
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.source.kind === "video" && (
        <Section title="Where you heard it">
          <p className="m-0 text-[17px] leading-7" style={{ color: "var(--ink-2)" }}>
            “{p.source.line}”
          </p>
          {videoId && (
            <Link href={`/watch/${videoId}`} className="text-sm">
              Open the video
            </Link>
          )}
        </Section>
      )}

      {p.culture && (
        <Section title="Context & culture">
          <p className="m-0 text-[17px] leading-7">{p.culture}</p>
        </Section>
      )}

      {p.similar.length > 0 && (
        <Section title="Similar ways to say it">
          <div className="card flex flex-col">
            {p.similar.map((s, i) => (
              <div key={s.text} className="flex items-center justify-between gap-3 px-5 py-3" style={i ? { borderTop: "1px solid var(--hairline)" } : undefined}>
                <span className="text-base">
                  “{s.text}”
                  {s.note && (
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      {" "}
                      — {s.note}
                    </span>
                  )}
                </span>
                <RegisterChip value={s.register} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <section className="flex flex-col gap-2">
        <label htmlFor="note" className="eyebrow">
          Your note
        </label>
        <textarea
          id="note"
          rows={2}
          className="input resize-y text-base leading-6"
          placeholder="Where do you want to use this?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== p.note && db.phrases.update(p.id, { note })}
        />
      </section>

      {lists.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow m-0">Lists</h2>
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => {
              const on = p.listIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  className="btn btn-sm"
                  style={on ? { background: "var(--accent-wash)", color: "var(--accent)", borderColor: "transparent" } : undefined}
                  onClick={() => db.phrases.update(p.id, { listIds: on ? p.listIds.filter((x) => x !== l.id) : [...p.listIds, l.id] })}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          className="btn min-h-12 px-6 font-semibold"
          onClick={markUsed}
          style={usedRecently ? { background: "var(--mint)", color: "var(--mint-ink)", borderColor: "transparent" } : { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "transparent" }}
        >
          {usedRecently ? "Used in real life ✓" : "I used this in real life"}
        </button>
        <Link href={scene ? `/talk/live?scene=${scene.id}` : "/talk"} className="btn min-h-12 px-5">
          Practice in Talk
        </Link>
        <div className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={retry} disabled={retrying}>
          Re-explain
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>
          <IconTrash size={16} /> Delete
        </button>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow m-0">{title}</h2>
      {children}
    </section>
  );
}
