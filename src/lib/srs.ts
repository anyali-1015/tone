import type { Srs } from "./types";

/**
 * A compact implementation of the FSRS-4.5 scheduler (default weights).
 * Grades: 1 Again · 2 Hard · 3 Good · 4 Easy.
 */
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RETENTION = 0.9;
const DAY = 86_400_000;

export type Grade = 1 | 2 | 3 | 4;

export function newSrs(now = Date.now()): Srs {
  return { due: now, stability: 0, difficulty: 0, reps: 0, lapses: 0, last: null };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function retrievability(elapsedDays: number, stability: number) {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function intervalDays(stability: number) {
  const days = (stability / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, 365);
}

export function review(card: Srs, grade: Grade, now = Date.now()): Srs {
  let { stability, difficulty } = card;
  if (card.reps === 0 || card.last === null) {
    stability = W[grade - 1];
    difficulty = clamp(W[4] - (grade - 3) * W[5], 1, 10);
  } else {
    const elapsed = Math.max(0, (now - card.last) / DAY);
    const r = retrievability(elapsed, stability);
    const d0Easy = W[4] - (4 - 3) * W[5];
    const nextD = difficulty - W[6] * (grade - 3);
    difficulty = clamp(W[7] * d0Easy + (1 - W[7]) * nextD, 1, 10);
    if (grade === 1) {
      stability =
        W[11] *
        Math.pow(difficulty, -W[12]) *
        (Math.pow(stability + 1, W[13]) - 1) *
        Math.exp(W[14] * (1 - r));
    } else {
      const hard = grade === 2 ? W[15] : 1;
      const easy = grade === 4 ? W[16] : 1;
      stability =
        stability *
        (1 +
          Math.exp(W[8]) *
            (11 - difficulty) *
            Math.pow(stability, -W[9]) *
            (Math.exp(W[10] * (1 - r)) - 1) *
            hard *
            easy);
    }
  }
  // "Again" comes back in 10 minutes; everything else on the FSRS interval.
  const due = grade === 1 ? now + 10 * 60_000 : now + intervalDays(stability) * DAY;
  return {
    due,
    stability,
    difficulty,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 1 && card.reps > 0 ? 1 : 0),
    last: now,
  };
}

export function isMastered(card: Srs) {
  return card.stability >= 21;
}
