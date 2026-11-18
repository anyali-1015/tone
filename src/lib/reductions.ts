/** Connected-speech reductions to mark softly in Shadow mode (spec §13, 3.2). */
const RULES: [RegExp, string][] = [
  [/\bgoing to\b/gi, "gonna"],
  [/\bwant to\b/gi, "wanna"],
  [/\bgot to\b/gi, "gotta"],
  [/\bhave to\b/gi, "hafta"],
  [/\bkind of\b/gi, "kinda"],
  [/\bsort of\b/gi, "sorta"],
  [/\blet me\b/gi, "lemme"],
  [/\bgive me\b/gi, "gimme"],
  [/\bdon'?t know\b/gi, "dunno"],
  [/\bdid you\b/gi, "didja"],
  [/\bdo you\b/gi, "d'ya"],
  [/\bwould you\b/gi, "wouldja"],
  [/\bcould you\b/gi, "couldja"],
  [/\bwhat are you\b/gi, "whatcha"],
  [/\bgot you\b/gi, "gotcha"],
  [/\bout of\b/gi, "outta"],
  [/\ba lot of\b/gi, "a lotta"],
  [/\bshould have\b/gi, "shoulda"],
  [/\bcould have\b/gi, "coulda"],
  [/\bwould have\b/gi, "woulda"],
];
const ALREADY = /\b(gonna|wanna|gotta|kinda|sorta|lemme|gimme|dunno|y'all|ya|gotcha|outta|lotta)\b/gi;

export interface Piece {
  text: string;
  sounds?: string;
}

/** Split a line into plain pieces and marked pieces ("want to" → sounds like "wanna"). */
export function markReductions(line: string): Piece[] {
  const marks: { start: number; end: number; sounds: string }[] = [];
  for (const [re, sounds] of RULES) {
    for (const m of line.matchAll(re)) marks.push({ start: m.index!, end: m.index! + m[0].length, sounds });
  }
  for (const m of line.matchAll(ALREADY)) marks.push({ start: m.index!, end: m.index! + m[0].length, sounds: "" });
  marks.sort((a, b) => a.start - b.start);
  const out: Piece[] = [];
  let i = 0;
  for (const m of marks) {
    if (m.start < i) continue;
    if (m.start > i) out.push({ text: line.slice(i, m.start) });
    out.push({ text: line.slice(m.start, m.end), sounds: m.sounds || "reduced" });
    i = m.end;
  }
  if (i < line.length) out.push({ text: line.slice(i) });
  return out;
}
