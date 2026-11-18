"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { RegisterChip } from "@/components/chips";
import { IconClose, IconSpeaker } from "@/components/icons";
import { collections } from "@/lib/collections";
import { db, logActivity } from "@/lib/db";
import { getScene, SCENES } from "@/lib/scenes";
import { getSettings } from "@/lib/settings";
import { speak } from "@/lib/speech";
import { review, type Grade } from "@/lib/srs";
import type { Phrase } from "@/lib/types";

type Kind = "echo" | "recall" | "pick" | "shorten";

interface Item {
  phrase: Phrase;
  kind: Kind;
  options?: string[];
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <Review />
    </Suspense>
  );
}

function kindsFor(p: Phrase): Kind[] {
  const k: Kind[] = ["echo"];
  if (p.meaning) k.push("recall");
  if (p.lessNatural.length > 0) k.push("pick");
  if (p.longVersion) k.push("shorten");
  return k;
}

function Review() {
  const params = useSearchParams();
  const router = useRouter();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [again, setAgain] = useState(0);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    (async () => {
      const now = Date.now();
      const all = await db.phrases.toArray();
      const lists = await db.lists.toArray();
      const key = params.get("c");
      const col = key ? collections(lists).find((c) => c.key === key) : undefined;
      let pool = col ? all.filter(col.test) : all;
      if (!params.get("all")) pool = pool.filter((p) => p.srs.due <= now);
      pool.sort((a, b) => a.srs.due - b.srs.due);
      const size = getSettings().reviewSize;
      const items = pool.slice(0, size).map((p, n) => {
        const kinds = kindsFor(p);
        const kind = kinds[(n + p.srs.reps) % kinds.length];
        const options = kind === "pick" ? [p.text, ...p.lessNatural].sort(() => Math.random() - 0.5) : undefined;
        return { phrase: p, kind, options };
      });
      setQueue(items);
    })();
  }, [params]);

  const item = queue?.[i];
  const done = queue !== null && i >= queue.length;

  const reveal = useCallback(() => {
    if (!item || revealed) return;
    setRevealed(true);
    speak(item.phrase.text);
  }, [item, revealed]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!item || !revealed) return;
      await db.phrases.update(item.phrase.id, { srs: review(item.phrase.srs, g) });
      if (g === 1) setAgain((a) => a + 1);
      setRevealed(false);
      setPicked(null);
      setI((n) => n + 1);
    },
    [item, revealed],
  );

  // Echo: play the phrase first so you can repeat it.
  useEffect(() => {
    if (item?.kind === "echo") speak(item.phrase.text);
  }, [item]);

  useEffect(() => {
    if (done) void logActivity("Expression", (Date.now() - startedAt.current) / 1000);
  }, [done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed && item?.kind !== "pick") reveal();
      } else if (["1", "2", "3", "4"].includes(e.key) && revealed) {
        void grade(Number(e.key) as Grade);
      } else if (e.key === "Escape") {
        router.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, item, reveal, grade, router]);

  if (queue === null) return null;

  const suggestion = (() => {
    const counts: Record<string, number> = {};
    for (const q of queue) {
      const sid = q.phrase.source.kind === "scene" || q.phrase.source.kind === "talk" ? q.phrase.source.sceneId : undefined;
      if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return getScene(top) ?? SCENES[0];
  })();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 px-7 py-4">
        <button type="button" className="btn h-11 w-11 p-0" aria-label="Exit review" onClick={() => router.back()}>
          <IconClose size={18} />
        </button>
        <div className="flex flex-1 flex-col gap-1.5">
          <div aria-hidden="true" className="h-1 rounded" style={{ background: "var(--hairline)" }}>
            <div className="h-1 rounded transition-all" style={{ width: `${queue.length ? (Math.min(i, queue.length) / queue.length) * 100 : 100}%`, background: "var(--accent)" }} />
          </div>
        </div>
        <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>
          {Math.min(i + 1, queue.length)} / {queue.length}
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {queue.length === 0 ? (
          <div className="card flex max-w-[520px] flex-col items-center gap-3 p-10 text-center">
            <h1 className="m-0 text-2xl font-semibold">Nothing due right now</h1>
            <p className="m-0" style={{ color: "var(--muted)" }}>
              Save a few phrases from a conversation or a video, and they&apos;ll come back here when it&apos;s time.
            </p>
            <Link href="/" className="btn btn-primary mt-2">
              Back to Today
            </Link>
          </div>
        ) : done ? (
          <div className="card rise flex max-w-[560px] flex-col items-center gap-3 p-10 text-center">
            <p className="eyebrow m-0">Done</p>
            <h1 className="m-0 text-[28px] font-semibold">
              {queue.length} reviewed · {again} to revisit
            </h1>
            <p className="m-0 text-[17px]" style={{ color: "var(--ink-2)" }}>
              Now use three of these out loud in a {suggestion.title.toLowerCase()} conversation.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/" className="btn">
                Done
              </Link>
              <Link href={`/talk/live?scene=${suggestion.id}`} className="btn btn-primary">
                Talk · {suggestion.title}
              </Link>
            </div>
          </div>
        ) : (
          item && (
            <div key={i} className="rise flex w-full max-w-[640px] flex-col gap-6">
              <div className="card flex min-h-[320px] flex-col items-center justify-center gap-5 px-10 py-12 text-center">
                <p className="eyebrow m-0">
                  {item.kind === "echo" ? "Echo · hear it, say it back" : item.kind === "recall" ? "Recall · say the phrase" : item.kind === "pick" ? "Pick · the most natural" : "Shorten · say it like a native"}
                </p>

                {item.kind === "echo" && (
                  <button type="button" onClick={() => speak(item.phrase.text)} className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--accent-wash)", color: "var(--accent)" }} aria-label="Play again">
                    <IconSpeaker size={26} />
                  </button>
                )}
                {item.kind === "recall" && <p className="m-0 text-[22px] leading-8">{item.phrase.meaning}</p>}
                {item.kind === "shorten" && (
                  <p className="m-0 text-[22px] leading-8" style={{ color: "var(--ink-2)" }}>
                    “{item.phrase.longVersion}”
                  </p>
                )}
                {item.kind === "pick" && (
                  <>
                    {item.phrase.meaning && (
                      <p className="m-0 text-[17px]" style={{ color: "var(--muted)" }}>
                        {item.phrase.meaning}
                      </p>
                    )}
                    <div className="flex w-full flex-col gap-2">
                      {item.options!.map((o) => {
                        const correct = o === item.phrase.text;
                        const style =
                          revealed && correct
                            ? { background: "var(--mint)", borderColor: "transparent", color: "var(--mint-ink)" }
                            : revealed && picked === o
                              ? { background: "var(--chip-trend)", borderColor: "transparent" }
                              : undefined;
                        return (
                          <button
                            key={o}
                            type="button"
                            disabled={revealed}
                            className="btn min-h-12 justify-start text-left text-base whitespace-normal"
                            style={style}
                            onClick={() => {
                              setPicked(o);
                              reveal();
                            }}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {revealed && item.kind !== "pick" && (
                  <div className="rise flex flex-col items-center gap-2">
                    <p className="m-0 text-[32px] leading-10 font-semibold tracking-tight">{item.phrase.text}</p>
                    <RegisterChip value={item.phrase.register} />
                  </div>
                )}
                {!revealed && item.kind !== "pick" && (
                  <button type="button" className="btn btn-primary mt-2" onClick={reveal}>
                    {item.kind === "echo" ? "I said it — show me" : "Show answer"}
                  </button>
                )}
              </div>

              {revealed && (
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      [1, "Again"],
                      [2, "Hard"],
                      [3, "Good"],
                      [4, "Easy"],
                    ] as const
                  ).map(([g, l]) => (
                    <button key={g} type="button" className="btn min-h-12" onClick={() => grade(g)}>
                      {l} <span className="kbd">{g}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="m-0 text-center text-xs" style={{ color: "var(--muted)" }}>
                Space to reveal · 1–4 to grade · Esc to exit
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
