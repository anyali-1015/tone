export type Register = "Casual" | "Neutral" | "Polite";
export type Currency = "Timeless" | "Current" | "Fading";
export type SafeWith = "friends" | "coworkers" | "anyone";
export type PhraseType = "Phrase" | "Frame" | "Trending";
export type Dimension = "Expression" | "Accent" | "Interaction" | "Culture";

export const DIMENSIONS: Dimension[] = ["Expression", "Accent", "Interaction", "Culture"];

export interface CaptionLine {
  start: number; // seconds
  dur: number; // seconds
  text: string;
}

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  lines: CaptionLine[];
  currentLine: number;
  shadowedLines: number[];
  createdAt: number;
  updatedAt: number;
}

export interface SimilarPhrase {
  text: string;
  register: Register;
  note?: string;
}

/** What the AI returns when it explains a phrase (spec §5 Notebook). */
export interface PhraseInfo {
  text: string;
  type: PhraseType;
  meaning: string;
  register: Register;
  currency: Currency;
  safeWith: SafeWith;
  longVersion: string; // "the long way to say it"
  examples: string[];
  culture: string;
  similar: SimilarPhrase[];
  lessNatural: string[]; // distractors for Pick cards
}

export interface Srs {
  due: number; // epoch ms
  stability: number; // days
  difficulty: number; // 1..10
  reps: number;
  lapses: number;
  last: number | null;
}

export type PhraseSource =
  | { kind: "video"; videoId: string; start: number; end: number; line: string }
  | { kind: "talk"; sceneId?: string; topic?: string; conversationId: string; said?: string }
  | { kind: "find"; description: string }
  | { kind: "scene"; sceneId: string };

export interface Phrase extends PhraseInfo {
  id: string;
  dimensions: Dimension[];
  source: PhraseSource;
  note: string;
  listIds: string[];
  usedCount: number;
  usedAt: number | null;
  srs: Srs;
  createdAt: number;
  enriched: boolean; // false while the AI card is still being filled
}

export interface Turn {
  id: string;
  role: "ai" | "user";
  text: string;
  twistId?: string;
  rewrite?: Rewrite;
}

export interface Rewrite {
  natural: boolean;
  best: string;
  why: string;
  alternatives: string[];
}

export interface Conversation {
  id: string;
  sceneId?: string;
  topic?: string;
  turns: Turn[];
  plannedTwists: string[];
  coveredTwists: string[];
  createdAt: number;
  endedAt: number | null;
}

export interface SceneProgress {
  sceneId: string;
  covered: string[];
  sessions: number;
  lastAt: number;
}

export interface ActivityEntry {
  id?: number;
  at: number;
  dimension: Dimension;
  seconds: number;
}

export interface Recording {
  id: string;
  videoId: string;
  line: number;
  blob: Blob;
  createdAt: number;
}

export interface UserList {
  id: string;
  name: string;
  createdAt: number;
}
