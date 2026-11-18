"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFindPhraseInsert } from "@/components/FindPhrase";
import { IconCheck, IconClose, IconMic, IconSpeaker } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { callAi } from "@/lib/ai";
import { db, logActivity, uid } from "@/lib/db";
import { savePhrase } from "@/lib/phrases";
import { getScene, planTwists, TOPICS, type Scene } from "@/lib/scenes";
import { recognitionSupported, speak, stopSpeaking, useDictation } from "@/lib/speech";
import type { Conversation, Phrase, Rewrite, SceneProgress, Turn } from "@/lib/types";

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <Live />
    </Suspense>
  );
}

interface RecapResult {
  improve: { said: string; better: string; why: string }[];
  usedWell: string[];
}

function Live() {
  const params = useSearchParams();
  const router = useRouter();
  const scene = getScene(params.get("scene"));
  const topicParam = params.get("topic");
  const topicTitle = TOPICS.find((t) => t.id === topicParam)?.title ?? topicParam ?? "";
  const pin = params.get("pin") ?? undefined;
  const partner = scene ? scene.partner : "Riley";
  const partnerName = scene ? scene.partnerName : "Riley";
  const initial = scene ? scene.partnerInitial : "R";

  const [conv, setConv] = useState<Conversation | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [hideText, setHideText] = useState(false);
  const [hint, setHint] = useState<string[] | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [openRewrites, setOpenRewrites] = useState<Record<string, boolean>>({});
  const [ended, setEnded] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const bottom = useRef<HTMLDivElement>(null);
  const dict = useDictation();
  const convRef = useRef<Conversation | null>(null);
  useEffect(() => {
    convRef.current = conv;
  }, [conv]);

  const convId = conv?.id;
  const savedHere = useLiveQuery(
    async (): Promise<Phrase[]> =>
      convId
        ? db.phrases.filter((p) => p.source.kind === "talk" && p.source.conversationId === convId).toArray()
        : [],
    [convId],
  );
  const sceneId = scene?.id;
  const progress = useLiveQuery(
    async (): Promise<SceneProgress | undefined> => (sceneId ? db.sceneProgress.get(sceneId) : undefined),
    [sceneId],
  );

  const persist = useCallback(async (c: Conversation) => {
    setConv(c);
    await db.conversations.put(c);
  }, []);

  /* ---- Start: the partner opens ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const covered = scene ? ((await db.sceneProgress.get(scene.id))?.covered ?? []) : [];
      const c: Conversation = {
        id: uid(),
        sceneId: scene?.id,
        topic: scene ? undefined : (topicParam ?? undefined),
        turns: [],
        plannedTwists: scene ? planTwists(scene, covered, pin) : [],
        coveredTwists: [],
        createdAt: Date.now(),
        endedAt: null,
      };
      if (scene) {
        const opener: Turn = { id: uid(), role: "ai", text: scene.opening };
        if (cancelled) return;
        await persist({ ...c, turns: [opener] });
        speak(opener.text);
      } else {
        if (cancelled) return;
        setConv(c);
        setThinking(true);
        try {
          const r = await callAi<{ reply: string }>("talk", { topic: topicParam, turns: [], plannedTwists: [], coveredTwists: [] });
          if (cancelled) return;
          await persist({ ...c, turns: [{ id: uid(), role: "ai", text: r.reply }] });
          speak(r.reply);
        } catch (e) {
          if (!cancelled) setError((e as Error).message);
        } finally {
          if (!cancelled) setThinking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv?.turns.length, openRewrites, hint, thinking]);

  /* ---- Send a turn and get the partner's reply ---- */
  const send = useCallback(
    async (text: string, wrapUp = false) => {
      const c = convRef.current;
      const said = text.trim();
      if (!c || (!said && !wrapUp) || thinking || ended) return;
      setError(null);
      setHint(null);
      setDraft("");
      dict.setInterim("");
      const turns = said ? [...c.turns, { id: uid(), role: "user" as const, text: said }] : c.turns;
      await persist({ ...c, turns });
      setThinking(true);
      try {
        const r = await callAi<{ reply: string; twistIds: string[]; shouldEnd: boolean }>("talk", {
          sceneId: c.sceneId,
          topic: c.topic,
          turns: turns.map(({ role, text }) => ({ role, text })),
          plannedTwists: c.plannedTwists,
          coveredTwists: c.coveredTwists,
          wrapUp,
        });
        const aiTurn: Turn = { id: uid(), role: "ai", text: r.reply, twistId: r.twistIds[0] };
        const covered = Array.from(new Set([...c.coveredTwists, ...r.twistIds]));
        await persist({ ...c, turns: [...turns, aiTurn], coveredTwists: covered });
        speak(r.reply, {
          onEnd: () => {
            if (r.shouldEnd) setRecapOpen(true);
          },
        });
        if (r.shouldEnd) setEnded(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setThinking(false);
      }
    },
    [thinking, ended, persist, dict],
  );

  /* ---- Hold Space to talk ---- */
  const holding = useRef(false);
  const beginTalk = useCallback(() => {
    if (holding.current || ended) return;
    holding.current = true;
    dict.start();
  }, [dict, ended]);
  const endTalk = useCallback(async () => {
    if (!holding.current) return;
    holding.current = false;
    const text = await dict.stop();
    if (text) void send(text);
  }, [dict, send]);

  const openFind = useFindPhraseInsert((t) => setDraft(t));

  const lastUser = useMemo(() => [...(conv?.turns ?? [])].reverse().find((t) => t.role === "user"), [conv]);

  /* ---- Say it more natively (on request) ---- */
  const requestRewrite = useCallback(
    async (turnId: string) => {
      const c = convRef.current;
      if (!c) return;
      const turn = c.turns.find((t) => t.id === turnId);
      if (!turn) return;
      setOpenRewrites((o) => ({ ...o, [turnId]: true }));
      if (turn.rewrite) return;
      setRewriting(turnId);
      try {
        const idx = c.turns.findIndex((t) => t.id === turnId);
        const r = await callAi<Rewrite>("rewrite", {
          turns: c.turns.slice(0, idx).map(({ role, text }) => ({ role, text })),
          said: turn.text,
          partner,
        });
        const latest = convRef.current!;
        await persist({ ...latest, turns: latest.turns.map((t) => (t.id === turnId ? { ...t, rewrite: r } : t)) });
        void logActivity("Expression", 20);
      } catch (e) {
        setError((e as Error).message);
        setOpenRewrites((o) => ({ ...o, [turnId]: false }));
      } finally {
        setRewriting(null);
      }
    },
    [partner, persist],
  );

  async function getHint() {
    const c = convRef.current;
    if (!c || hintLoading) return;
    if (hint) {
      setHint(null);
      return;
    }
    setHintLoading(true);
    try {
      const r = await callAi<{ options: string[] }>("hint", { turns: c.turns.map(({ role, text }) => ({ role, text })), partner });
      setHint(r.options);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHintLoading(false);
    }
  }

  /* ---- Finish: save progress once ---- */
  const finished = useRef(false);
  const finish = useCallback(async () => {
    const c = convRef.current;
    if (!c || finished.current) return;
    finished.current = true;
    stopSpeaking();
    await db.conversations.update(c.id, { endedAt: Date.now() });
    if (c.sceneId) {
      const prev = await db.sceneProgress.get(c.sceneId);
      await db.sceneProgress.put({
        sceneId: c.sceneId,
        covered: Array.from(new Set([...(prev?.covered ?? []), ...c.coveredTwists])),
        sessions: (prev?.sessions ?? 0) + 1,
        lastAt: Date.now(),
      });
    }
    await logActivity("Interaction", (Date.now() - startedAt.current) / 1000);
  }, []);

  function wrapUp() {
    setEnded(true);
    setRecapOpen(true);
  }

  useEffect(() => {
    if (recapOpen) void finish();
  }, [recapOpen, finish]);

  // Save progress if the window is closed mid-conversation.
  useEffect(() => {
    return () => {
      const c = convRef.current;
      if (c && c.turns.some((t) => t.role === "user")) void finish();
    };
  }, [finish]);

  /* ---- Keyboard ---- */
  useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
    const down = (e: KeyboardEvent) => {
      if (recapOpen) return;
      if (e.key === " " && !typing(e) && !e.repeat) {
        e.preventDefault();
        beginTalk();
      } else if (e.key === " " && !typing(e)) {
        e.preventDefault();
      } else if ((e.key === "n" || e.key === "N") && !typing(e) && !e.metaKey && !e.ctrlKey && lastUser) {
        e.preventDefault();
        void requestRewrite(lastUser.id);
      } else if (e.key === "Escape" && !typing(e)) {
        router.push(scene ? `/talk/scene/${scene.id}` : "/talk");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " " && holding.current) {
        e.preventDefault();
        void endTalk();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [beginTalk, endTalk, lastUser, requestRewrite, recapOpen, router, scene]);

  const currentTwist = scene && conv ? scene.twists.find((t) => t.id === [...conv.turns].reverse().find((x) => x.twistId)?.twistId) : undefined;
  const everCovered = new Set([...(progress?.covered ?? []), ...(conv?.coveredTwists ?? [])]);

  if (!scene && !topicParam) {
    return (
      <p className="p-10">
        Pick a Scene or topic first. <Link href="/talk">Go to Talk</Link>
      </p>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-x-0 border-t-0 px-7 py-3.5" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="flex items-center gap-4">
          <Link href={scene ? `/talk/scene/${scene.id}` : "/talk"} aria-label="Exit conversation" className="btn h-11 w-11 p-0">
            <IconClose size={18} />
          </Link>
          <div>
            <p className="m-0 text-xs" style={{ color: "var(--muted)" }}>
              {scene ? "Talk · Scene" : "Talk · Topic"}
            </p>
            <h1 className="m-0 text-lg font-semibold">{scene ? scene.title : topicTitle}</h1>
          </div>
          {currentTwist && (
            <span className="chip text-[13px]" style={{ background: "var(--twist)", color: "var(--twist-ink)", padding: "6px 12px" }}>
              Situation: {currentTwist.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" aria-pressed={hideText} onClick={() => setHideText((v) => !v)} style={hideText ? { background: "var(--accent-wash)" } : undefined}>
            {hideText ? "Show text" : "Hide text"}
          </button>
          <button type="button" className="btn font-semibold" onClick={wrapUp} disabled={!conv || !lastUser}>
            Wrap up
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-wrap gap-8 px-7 py-8">
        <main className="flex min-w-0 flex-[999_1_560px] justify-center">
          <div className="flex w-full max-w-[680px] flex-col gap-5">
            {conv?.turns.map((t) =>
              t.role === "ai" ? (
                <div key={t.id} className="rise flex items-start gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: "#F1E6D8", color: "#7A4E1D" }}>
                    {initial}
                  </span>
                  <div className="flex max-w-[80%] flex-col gap-1.5">
                    <p className="m-0 text-xs" style={{ color: "var(--muted)" }}>
                      {partnerName}
                    </p>
                    <div className="card flex items-center gap-2.5 px-4.5 py-3.5" style={{ borderRadius: "4px 20px 20px 20px" }}>
                      <p className="m-0 text-[17px] leading-[26px]" style={hideText ? { color: "var(--muted)", fontSize: 15 } : undefined}>
                        {hideText ? "Text hidden — listen" : t.text}
                      </p>
                      <button type="button" aria-label="Replay" onClick={() => speak(t.text)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--wash)" }}>
                        <IconSpeaker size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={t.id} className="rise flex flex-col items-end gap-2">
                  <div className="max-w-[80%] px-4.5 py-3.5" style={{ background: "var(--accent-wash)", borderRadius: "20px 4px 20px 20px" }}>
                    <p className="m-0 text-[17px] leading-[26px]">{t.text}</p>
                  </div>
                  {openRewrites[t.id] ? (
                    t.rewrite ? (
                      <RewriteCard
                        rewrite={t.rewrite}
                        onHide={() => setOpenRewrites((o) => ({ ...o, [t.id]: false }))}
                        onSave={(text) =>
                          savePhrase({
                            text,
                            source: { kind: "talk", sceneId: scene?.id, topic: conv.topic, conversationId: conv.id, said: t.text },
                            dimensions: ["Expression", "Interaction"],
                            known: { longVersion: t.text },
                            context: `In a ${scene?.title ?? topicTitle} conversation the learner said "${t.text}"; a native would say "${text}".`,
                          })
                        }
                        saved={new Set((savedHere ?? []).map((p) => p.text.toLowerCase()))}
                      />
                    ) : (
                      <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                        {rewriting === t.id ? "Thinking how a native would say it…" : ""}
                      </p>
                    )
                  ) : (
                    <button type="button" onClick={() => requestRewrite(t.id)} className="min-h-8 px-1 text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                      Say it more natively
                    </button>
                  )}
                </div>
              ),
            )}

            {thinking && (
              <div className="flex items-center gap-3" aria-live="polite">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: "#F1E6D8", color: "#7A4E1D" }}>
                  {initial}
                </span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {partnerName} is replying…
                </span>
              </div>
            )}

            {hint && (
              <div className="rise flex max-w-[80%] flex-col gap-1.5 self-end rounded-2xl px-4.5 py-3.5" style={{ border: "1px dashed var(--hairline-2)", background: "var(--glass-strong)" }}>
                <p className="eyebrow m-0">You could say</p>
                {hint.map((h) => (
                  <button key={h} type="button" className="text-left text-base" onClick={() => setDraft(h)}>
                    “{h}”
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            {ended && !recapOpen && (
              <div className="flex justify-center">
                <button type="button" className="btn btn-primary" onClick={() => setRecapOpen(true)}>
                  See your recap
                </button>
              </div>
            )}
            <div ref={bottom} className="min-h-4 grow" />

            <div className="glass sticky bottom-6 flex items-center gap-3 rounded-full p-3" style={{ boxShadow: "var(--shadow-md)" }}>
              <button
                type="button"
                aria-label="Hold to talk"
                disabled={ended || !recognitionSupported()}
                onMouseDown={beginTalk}
                onMouseUp={() => void endTalk()}
                onMouseLeave={() => holding.current && void endTalk()}
                className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-full ${dict.listening ? "listening" : ""}`}
                style={{ width: 52, height: 52, background: "var(--accent)", color: "var(--accent-ink)", opacity: ended ? 0.5 : 1 }}
              >
                <IconMic size={22} />
              </button>
              <label htmlFor="reply" className="sr-only">
                Your reply
              </label>
              <input
                id="reply"
                className="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
                style={{ color: "var(--ink)" }}
                placeholder={
                  dict.listening
                    ? "Listening…"
                    : recognitionSupported()
                      ? "Hold Space to talk, or type…"
                      : "Type your reply… (voice needs Chrome)"
                }
                value={dict.listening ? dict.interim : draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void send(draft);
                  } else if (e.key === "Escape") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                disabled={ended}
              />
              <button type="button" className="btn" aria-pressed={Boolean(hint)} onClick={getHint} disabled={ended || hintLoading}>
                {hintLoading ? "…" : "Hint"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={openFind} style={{ background: "var(--wash)" }}>
                ⌘K Find the phrase
              </button>
            </div>
            {dict.error && (
              <p role="alert" className="-mt-2 m-0 text-center text-[13px]" style={{ color: "var(--danger)" }}>
                {dict.error}
              </p>
            )}
            <p className="-mt-2 m-0 text-center text-xs" style={{ color: "var(--muted)" }}>
              Hold Space to talk · N: say my last line more natively · ⌘K find a phrase · Esc exit
            </p>
          </div>
        </main>

        <aside aria-label="This conversation" className="glass flex max-w-[320px] min-w-[240px] flex-[1_1_260px] flex-col gap-6 self-start rounded-3xl p-5">
          <section className="flex flex-col gap-2.5">
            <h2 className="eyebrow m-0">Saved here</h2>
            {(savedHere ?? []).length === 0 ? (
              <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                Phrases you save from rewrites show up here.
              </p>
            ) : (
              savedHere!.map((p) => (
                <Link key={p.id} href={`/notebook/${p.id}`} target="_blank" className="rounded-xl px-3 py-2.5 text-sm font-medium no-underline" style={{ background: "var(--surface)", color: "var(--ink)" }}>
                  {p.text}
                </Link>
              ))
            )}
          </section>
          {scene && conv && (
            <section className="flex flex-col gap-2.5">
              <h2 className="eyebrow m-0">
                Situations · {everCovered.size} of {scene.twists.length}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {Array.from(new Set([...conv.plannedTwists, ...conv.coveredTwists])).map((id) => {
                  const t = scene.twists.find((x) => x.id === id)!;
                  const done = conv.coveredTwists.includes(id);
                  const now = currentTwist?.id === id;
                  return (
                    <li key={id} className="flex items-center gap-2" style={{ color: done || now ? "var(--ink)" : "var(--muted)", fontWeight: now ? 600 : 400 }}>
                      <span aria-hidden="true" style={{ color: done ? "var(--mint-ink)" : "var(--accent)" }}>
                        {done ? "✓" : "○"}
                      </span>
                      {t.label}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {recapOpen && conv && (
        <Recap
          conv={conv}
          scene={scene}
          partner={partner}
          everCovered={everCovered.size}
          onSave={(text, said) =>
            savePhrase({
              text,
              source: { kind: "talk", sceneId: scene?.id, topic: conv.topic, conversationId: conv.id, said },
              dimensions: ["Expression", "Interaction"],
              known: { longVersion: said },
              context: `The learner said "${said}"; a native would say "${text}".`,
            })
          }
          onClose={() => router.push(scene ? `/talk/scene/${scene.id}` : "/talk")}
          onAgain={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function RewriteCard({
  rewrite,
  onHide,
  onSave,
  saved,
}: {
  rewrite: Rewrite;
  onHide: () => void;
  onSave: (text: string) => void;
  saved: Set<string>;
}) {
  const [showAlts, setShowAlts] = useState(false);
  if (rewrite.natural) {
    return (
      <p className="rise m-0 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--mint-ink)" }}>
        <IconCheck size={14} /> Natural
        {rewrite.why && <span className="font-normal" style={{ color: "var(--muted)" }}>· {rewrite.why}</span>}
      </p>
    );
  }
  const isSaved = saved.has(rewrite.best.replace(/^["“]|["”]$/g, "").toLowerCase());
  return (
    <div className="rise flex max-w-[80%] flex-col gap-1.5 rounded-2xl px-4.5 py-3.5" style={{ background: "var(--mint)" }}>
      <p className="eyebrow m-0" style={{ color: "var(--mint-ink)" }}>
        More native
      </p>
      <p className="m-0 text-[17px] leading-[26px] font-semibold">“{rewrite.best}”</p>
      {rewrite.why && (
        <p className="m-0 text-sm leading-[22px]" style={{ color: "var(--ink-2)" }}>
          {rewrite.why}
        </p>
      )}
      {showAlts &&
        rewrite.alternatives.map((a) => (
          <p key={a} className="m-0 text-sm" style={{ color: "var(--ink-2)" }}>
            Also: “{a}”
          </p>
        ))}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-sm" style={{ background: "var(--ink)", color: "var(--bg)", borderColor: "transparent" }} disabled={isSaved} onClick={() => onSave(rewrite.best)}>
          {isSaved ? "Saved" : "Save"}
        </button>
        {rewrite.alternatives.length > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAlts((v) => !v)}>
            {showAlts ? "Fewer" : "Alternatives"}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => speak(rewrite.best)}>
          Hear it
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onHide}>
          Hide
        </button>
      </div>
    </div>
  );
}

function Recap({
  conv,
  scene,
  partner,
  everCovered,
  onSave,
  onClose,
  onAgain,
}: {
  conv: Conversation;
  scene?: Scene;
  partner: string;
  everCovered: number;
  onSave: (text: string, said: string) => Promise<unknown>;
  onClose: () => void;
  onAgain: () => void;
}) {
  const userTurns = conv.turns.filter((t) => t.role === "user").length;
  const [data, setData] = useState<RecapResult | null>(userTurns ? null : { improve: [], usedWell: [] });
  const [error, setError] = useState<string | null>(null);
  const [savedAll, setSavedAll] = useState(false);

  useEffect(() => {
    if (!userTurns) return;
    callAi<RecapResult>("recap", { turns: conv.turns.map(({ role, text }) => ({ role, text })), partner })
      .then(setData)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAll() {
    for (const i of data?.improve ?? []) await onSave(i.better, i.said);
    setSavedAll(true);
  }

  return (
    <Modal label="Conversation recap" onClose={onClose} width={720}>
      <div className="flex flex-col gap-6 p-7">
        <div className="flex flex-col gap-1">
          <p className="eyebrow m-0">Recap</p>
          <h2 className="m-0 text-2xl font-semibold">
            {userTurns} turn{userTurns === 1 ? "" : "s"} · {scene ? scene.title : "Free talk"}
          </h2>
          {scene && (
            <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>
              {scene.title}: {everCovered} of {scene.twists.length} situations practiced
            </p>
          )}
        </div>

        {!data && !error && <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>Reviewing your side of the conversation…</p>}
        {error && <p className="m-0 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

        {data && (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="eyebrow m-0">Most worth improving</h3>
                {data.improve.length > 0 && (
                  <button type="button" className="btn btn-sm" onClick={saveAll} disabled={savedAll}>
                    {savedAll ? "Saved" : "Save all"}
                  </button>
                )}
              </div>
              {data.improve.length === 0 && (
                <p className="m-0 text-sm" style={{ color: "var(--mint-ink)" }}>
                  Nothing big to fix — that sounded natural.
                </p>
              )}
              {data.improve.map((i) => (
                <div key={i.said} className="grid grid-cols-2 gap-3">
                  <div className="card p-4">
                    <p className="eyebrow m-0 mb-1">You said</p>
                    <p className="m-0 text-[15px]" style={{ color: "var(--ink-2)" }}>
                      {i.said}
                    </p>
                  </div>
                  <div className="rounded-[20px] p-4" style={{ background: "var(--mint)" }}>
                    <p className="eyebrow m-0 mb-1" style={{ color: "var(--mint-ink)" }}>
                      Native
                    </p>
                    <p className="m-0 text-[15px] font-semibold">{i.better}</p>
                    <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
                      {i.why}
                    </p>
                  </div>
                </div>
              ))}
            </section>
            {data.usedWell.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="eyebrow m-0">You used these well</h3>
                <div className="flex flex-wrap gap-2">
                  {data.usedWell.map((u) => (
                    <span key={u} className="chip chip-casual text-[13px]">
                      {u}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onAgain}>
            Talk again
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
