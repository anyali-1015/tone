import "server-only";

import { getScene, TOPICS } from "@/lib/scenes";
import type { Currency, PhraseInfo, PhraseType, Register, Rewrite, SafeWith } from "@/lib/types";
import { generateJson } from "./llm";

const COACH = `You are the language coach inside Tone, an app for an ADVANCED non-native English speaker (based in Singapore) whose grammar and accent are already strong. Their goal is to sound like a native speaker of current, everyday American English.
Their core gap is COMPRESSION: they explain in a full sentence what a native says in two or three words. Always favor the short, idiomatic, natural option a 25–40-year-old American would actually say out loud today.
Never be beginner-level. Never simplify. Use real American spelling and usage.
Respond with JSON only, exactly in the shape requested.`;

type Turn = { role: "ai" | "user"; text: string };

const REGISTERS: Register[] = ["Casual", "Neutral", "Polite"];
const CURRENCIES: Currency[] = ["Timeless", "Current", "Fading"];
const SAFE: SafeWith[] = ["friends", "coworkers", "anyone"];
const TYPES: PhraseType[] = ["Phrase", "Frame", "Trending"];

const pick = <T extends string>(v: unknown, options: T[], fallback: T): T =>
  options.find((o) => o.toLowerCase() === String(v ?? "").toLowerCase()) ?? fallback;
const str = (v: unknown, max = 600) => String(v ?? "").trim().slice(0, max);
const strs = (v: unknown, n: number) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, 240)).filter(Boolean).slice(0, n);

function transcript(turns: Turn[], partner: string) {
  return turns.map((t) => `${t.role === "ai" ? partner : "Learner"}: ${t.text}`).join("\n");
}

/* ---------- explain: a full phrase card ---------- */

export async function explain(input: { text: string; context?: string }): Promise<PhraseInfo> {
  const raw = await generateJson<Record<string, unknown>>({
    temperature: 0.4,
    system: COACH,
    prompt: `Explain this English expression for the learner's phrase notebook.
Expression: "${str(input.text, 200)}"
${input.context ? `Where they met it: "${str(input.context, 500)}"` : ""}

Return JSON:
{
 "text": the expression in its natural dictionary form (lowercase unless it's a full sentence),
 "type": "Phrase" (an idiom/short phrase) | "Frame" (a reusable sentence pattern like "Mind if I…?") | "Trending" (current social-media / slang expression),
 "meaning": one plain-English sentence, under 20 words,
 "register": "Casual" | "Neutral" | "Polite",
 "currency": "Timeless" | "Current" (popular now, may date) | "Fading" (sounds dated),
 "safeWith": "friends" | "coworkers" | "anyone",
 "longVersion": the wordy way a non-native might say the same thing (one sentence),
 "examples": 2 short natural example lines an American would say,
 "culture": 1–2 sentences on when/how natives use it, any unspoken rule or nuance,
 "similar": 2–3 other ways to say it, ordered casual → polite, each {"text","register","note" (optional, ≤8 words)},
 "lessNatural": 2 grammatical but less natural ways to say the same thing (used as distractors)
}`,
  });
  return {
    text: str(raw.text, 200) || input.text,
    type: pick(raw.type, TYPES, "Phrase"),
    meaning: str(raw.meaning),
    register: pick(raw.register, REGISTERS, "Neutral"),
    currency: pick(raw.currency, CURRENCIES, "Timeless"),
    safeWith: pick(raw.safeWith, SAFE, "anyone"),
    longVersion: str(raw.longVersion),
    examples: strs(raw.examples, 3),
    culture: str(raw.culture),
    similar: (Array.isArray(raw.similar) ? raw.similar : [])
      .slice(0, 3)
      .map((s: Record<string, unknown>) => ({
        text: str(s?.text, 120),
        register: pick(s?.register, REGISTERS, "Neutral"),
        note: str(s?.note, 80) || undefined,
      }))
      .filter((s) => s.text),
    lessNatural: strs(raw.lessNatural, 2),
  };
}

/* ---------- find the phrase (⌘K) ---------- */

export interface FindOption {
  text: string;
  register: Register;
  currency: Currency;
  example: string;
  why: string;
}

export async function find(input: { description: string }): Promise<{ options: FindOption[] }> {
  const raw = await generateJson<{ options?: Record<string, unknown>[] }>({
    temperature: 0.5,
    system: COACH,
    prompt: `The learner describes, at length, something they want to say:
"${str(input.description, 800)}"

Give 2–3 ways a native American speaker would actually say it, SHORTEST FIRST. Prefer real idioms, set phrases and current expressions over paraphrases.
Return JSON: {"options":[{"text": the shorthand, "register": "Casual"|"Neutral"|"Polite", "currency": "Timeless"|"Current"|"Fading", "example": one natural example sentence using it, "why": ≤15 words on when it fits}]}`,
  });
  return {
    options: (raw.options ?? []).slice(0, 3).map((o) => ({
      text: str(o.text, 160),
      register: pick(o.register, REGISTERS, "Neutral"),
      currency: pick(o.currency, CURRENCIES, "Timeless"),
      example: str(o.example, 240),
      why: str(o.why, 160),
    })),
  };
}

/* ---------- talk: the AI partner's next line ---------- */

export interface TalkInput {
  sceneId?: string;
  topic?: string;
  turns: Turn[];
  plannedTwists: string[];
  coveredTwists: string[];
  wrapUp?: boolean;
}

export async function talk(input: TalkInput): Promise<{ reply: string; twistIds: string[]; shouldEnd: boolean }> {
  const scene = getScene(input.sceneId);
  const topicTitle = TOPICS.find((t) => t.id === input.topic)?.title ?? str(input.topic, 120);
  const userTurns = input.turns.filter((t) => t.role === "user").length;

  let setup: string;
  let partner = "Friend";
  if (scene) {
    partner = scene.partner;
    const planned = scene.twists.filter((t) => input.plannedTwists.includes(t.id));
    const remaining = planned.filter((t) => !input.coveredTwists.includes(t.id));
    setup = `ROLE-PLAY. ${scene.persona}
Setting: ${scene.title}. You speak first and keep the scene moving the way it really would.
Situations to weave in during this conversation, ONE AT A TIME, when they fit naturally (these are the point of the exercise):
${remaining.map((t) => `- [${t.id}] ${t.label}: ${t.direction}`).join("\n") || "- (all planned situations are done; you may add a natural follow-up from the full list below or start wrapping up)"}
Other things that can naturally happen in this scene: ${scene.twists.map((t) => `[${t.id}] ${t.label}`).join("; ")}.`;
  } else {
    setup = `FREE CONVERSATION. You are Riley, a friendly, curious American in your early 30s, chatting with the learner as a friend about: "${topicTitle}". Share your own (invented but realistic) experiences and opinions, ask follow-up questions, react genuinely.`;
  }

  const raw = await generateJson<{ reply?: string; twistIds?: string[]; shouldEnd?: boolean }>({
    temperature: 0.9,
    system: `You play a real American in a spoken conversation with an advanced English learner.
Rules:
- Speak exactly like a native would out loud: contractions, natural fillers ("oh", "gotcha", "totally"), idioms, the occasional current slang. NEVER simplify or slow down your English.
- 1–3 short sentences per turn. This is speech, not writing. No emoji, no stage directions, no lists.
- Never correct or comment on the learner's English and never break character. If they're unclear, react the way a real person would ("Sorry, what was that?").
- Extend the conversation: a real person adds a follow-up, a detail, or a question; don't just answer.
- ${input.wrapUp || userTurns >= 14 ? "It's time to wrap up: close the conversation naturally in this turn and set shouldEnd to true." : "Do not end the conversation yet unless the learner clearly says goodbye."}
Respond with JSON only: {"reply": your line, "twistIds": ids of any listed situations your line introduces or completes (may be empty), "shouldEnd": boolean}`,
    prompt: `${setup}

Conversation so far:
${input.turns.length ? transcript(input.turns, partner) : "(nothing yet — you open)"}

Your next line as ${scene ? scene.partnerName : "Riley"}:`,
  });
  const validIds = new Set(scene?.twists.map((t) => t.id) ?? []);
  return {
    reply: str(raw.reply, 500) || "Sorry, what was that?",
    twistIds: (raw.twistIds ?? []).filter((id) => validIds.has(id)),
    shouldEnd: Boolean(raw.shouldEnd),
  };
}

/* ---------- rewrite: "Say it more natively" ---------- */

export async function rewrite(input: { turns: Turn[]; said: string; partner: string }): Promise<Rewrite> {
  const raw = await generateJson<Record<string, unknown>>({
    temperature: 0.4,
    system: COACH,
    prompt: `In this spoken conversation the learner just said the LAST line. Judge it the way a native speaker would hear it.
${transcript(input.turns.slice(-6), input.partner)}
Learner (the line to judge): "${str(input.said, 500)}"

If a native could plausibly say it as-is in this situation, mark natural: true (small stylistic differences don't count).
Otherwise give the most natural version a native would say here — usually SHORTER — keeping the same meaning and politeness.
Return JSON: {"natural": boolean, "best": the native version (or the original if natural), "why": ONE sentence, ≤22 words, naming the specific change (e.g. why "Can I get" beats "I would like"), "alternatives": 0–2 other natural ways, can include a more casual one}`,
  });
  return {
    natural: Boolean(raw.natural),
    best: str(raw.best, 300) || input.said,
    why: str(raw.why, 240),
    alternatives: strs(raw.alternatives, 2),
  };
}

/* ---------- hint: "What could I say?" ---------- */

export async function hint(input: { turns: Turn[]; partner: string }): Promise<{ options: string[] }> {
  const raw = await generateJson<{ options?: string[] }>({
    temperature: 0.7,
    system: COACH,
    prompt: `The learner is stuck in this conversation and it's their turn:
${transcript(input.turns.slice(-6), input.partner)}

Give 2 short, natural things a native might say next (shortest first). Use [brackets] for personal details like [your name].
Return JSON: {"options": ["...", "..."]}`,
  });
  return { options: strs(raw.options, 2) };
}

/* ---------- recap ---------- */

export interface RecapItem {
  said: string;
  better: string;
  why: string;
}

export async function recap(input: { turns: Turn[]; partner: string }): Promise<{ improve: RecapItem[]; usedWell: string[] }> {
  const raw = await generateJson<{ improve?: Record<string, unknown>[]; usedWell?: string[] }>({
    temperature: 0.3,
    system: COACH,
    prompt: `Review the learner's side of this conversation:
${transcript(input.turns, input.partner)}

1. Pick the (up to) 3 learner turns most worth improving — the biggest gap between what they said and what a native would say. Skip turns that were already natural.
2. List up to 4 short phrases the learner used that already sounded native.
Return JSON: {"improve":[{"said": their exact words, "better": the native version, "why": ≤18 words}], "usedWell": ["..."]}`,
  });
  return {
    improve: (raw.improve ?? []).slice(0, 3).map((i) => ({
      said: str(i.said, 300),
      better: str(i.better, 300),
      why: str(i.why, 200),
    })),
    usedWell: strs(raw.usedWell, 4),
  };
}
