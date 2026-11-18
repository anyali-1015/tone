import { isMastered } from "./srs";
import { DIMENSIONS, type Phrase, type UserList } from "./types";

export interface Collection {
  key: string;
  name: string;
  group: string;
  test: (p: Phrase) => boolean;
}

export function collections(lists: UserList[]): Collection[] {
  return [
    { key: "all", name: "All phrases", group: "", test: () => true },
    { key: "type:Phrase", name: "Short phrases", group: "By type", test: (p) => p.type === "Phrase" },
    { key: "type:Frame", name: "Sentence frames", group: "By type", test: (p) => p.type === "Frame" },
    { key: "type:Trending", name: "Trending", group: "By type", test: (p) => p.type === "Trending" },
    { key: "src:talk", name: "From conversations", group: "By source", test: (p) => p.source.kind === "talk" || p.source.kind === "scene" },
    { key: "src:video", name: "From videos", group: "By source", test: (p) => p.source.kind === "video" },
    { key: "src:find", name: "From Find the phrase", group: "By source", test: (p) => p.source.kind === "find" },
    ...DIMENSIONS.map((d) => ({ key: `dim:${d}`, name: d, group: "By dimension", test: (p: Phrase) => p.dimensions.includes(d) })),
    ...lists.map((l) => ({ key: `list:${l.id}`, name: l.name, group: "Your lists", test: (p: Phrase) => p.listIds.includes(l.id) })),
  ];
}

export type Filter = "all" | "due" | "mastered" | "used";

export function applyFilter(p: Phrase, f: Filter, now = Date.now()) {
  if (f === "due") return p.srs.due <= now;
  if (f === "mastered") return isMastered(p.srs);
  if (f === "used") return p.usedCount > 0;
  return true;
}
