"use client";

import { callAi } from "./ai";
import { db, uid } from "./db";
import { newSrs } from "./srs";
import type { Dimension, Phrase, PhraseInfo, PhraseSource } from "./types";

/**
 * Save a phrase right away (so the click feels instant), then let the AI fill in the
 * full card in the background. Anything already known (e.g. from a ⌘K result) is kept.
 */
export async function savePhrase(opts: {
  text: string;
  source: PhraseSource;
  dimensions?: Dimension[];
  known?: Partial<PhraseInfo>;
  /** The known info is a full AI card already; skip the background fill. */
  complete?: boolean;
  context?: string;
}): Promise<string> {
  const text = opts.text.trim().replace(/^["“]|["”]$/g, "");
  const existing = await db.phrases.filter((p) => p.text.toLowerCase() === text.toLowerCase()).first();
  if (existing) return existing.id;

  const id = uid();
  const phrase: Phrase = {
    id,
    text,
    type: opts.known?.type ?? "Phrase",
    meaning: opts.known?.meaning ?? "",
    register: opts.known?.register ?? "Neutral",
    currency: opts.known?.currency ?? "Timeless",
    safeWith: opts.known?.safeWith ?? "anyone",
    longVersion: opts.known?.longVersion ?? "",
    examples: opts.known?.examples ?? [],
    culture: opts.known?.culture ?? "",
    similar: opts.known?.similar ?? [],
    lessNatural: opts.known?.lessNatural ?? [],
    dimensions: opts.dimensions ?? ["Expression"],
    source: opts.source,
    note: "",
    listIds: [],
    usedCount: 0,
    usedAt: null,
    srs: newSrs(),
    createdAt: Date.now(),
    enriched: Boolean(opts.complete),
  };
  await db.phrases.add(phrase);
  if (!opts.complete) void enrichPhrase(id, opts.context);
  return id;
}

export async function enrichPhrase(id: string, context?: string) {
  const p = await db.phrases.get(id);
  if (!p) return;
  try {
    const info = await callAi<PhraseInfo>("explain", { text: p.text, context });
    await db.phrases.update(id, {
      ...info,
      text: p.text, // keep what the learner saved
      longVersion: p.longVersion || info.longVersion,
      enriched: true,
    });
  } catch {
    /* stays un-enriched; the card offers a retry */
  }
}

export function sourceLabel(p: Phrase): string {
  switch (p.source.kind) {
    case "video":
      return "Saved from a video";
    case "talk":
      return "Saved from a conversation";
    case "find":
      return "Saved from Find the phrase";
    case "scene":
      return "Saved from a Scene";
  }
}
