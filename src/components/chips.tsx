import type { Currency, PhraseType, Register } from "@/lib/types";

export function RegisterChip({ value }: { value: Register }) {
  const cls = value === "Casual" ? "chip chip-casual" : value === "Polite" ? "chip chip-polite" : "chip";
  return <span className={cls}>{value}</span>;
}

export function CurrencyChip({ value }: { value: Currency }) {
  return <span className={value === "Current" ? "chip chip-trend" : "chip"}>{value}</span>;
}

export function TypeChip({ value }: { value: PhraseType }) {
  const label = value === "Frame" ? "Sentence frame" : value;
  return <span className={value === "Trending" ? "chip chip-trend" : "chip"}>{label}</span>;
}
