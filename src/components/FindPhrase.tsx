"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { callAi } from "@/lib/ai";
import { logActivity } from "@/lib/db";
import { savePhrase } from "@/lib/phrases";
import type { Currency, Register } from "@/lib/types";
import { CurrencyChip, RegisterChip } from "./chips";
import { IconCheck, IconSearch } from "./icons";
import { Modal } from "./Modal";

interface FindOption {
  text: string;
  register: Register;
  currency: Currency;
  example: string;
  why: string;
}

interface OpenOptions {
  prefill?: string;
  /** In a conversation, a result can be inserted as the next message. */
  onInsert?: (text: string) => void;
}

const Ctx = createContext<{ open: (o?: OpenOptions) => void }>({ open: () => {} });

export function useFindPhrase() {
  return useContext(Ctx);
}

export function FindPhraseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OpenOptions | null>(null);
  const insertRef = useRef<OpenOptions["onInsert"]>(undefined);
  const open = useCallback((o: OpenOptions = {}) => {
    insertRef.current = o.onInsert;
    setState(o);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setState((s) => s ?? { onInsert: insertRef.current });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Pages (like a conversation) can register an insert target for ⌘K opened by keyboard. */
  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && <FindPanel prefill={state.prefill} onInsert={state.onInsert} onClose={() => setState(null)} />}
    </Ctx.Provider>
  );
}

/** Let a page make ⌘K results insertable while it is mounted. */
export function useFindPhraseInsert(onInsert: (text: string) => void) {
  const { open } = useFindPhrase();
  const ref = useRef(onInsert);
  useEffect(() => {
    ref.current = onInsert;
  }, [onInsert]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        open({ onInsert: (t) => ref.current(t) });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
  return useCallback(() => open({ onInsert: (t) => ref.current(t) }), [open]);
}

function FindPanel({
  prefill,
  onInsert,
  onClose,
}: {
  prefill?: string;
  onInsert?: (t: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(prefill ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<FindOption[] | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  async function run() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    const t0 = Date.now();
    try {
      const res = await callAi<{ options: FindOption[] }>("find", { description: text });
      setOptions(res.options);
      void logActivity("Expression", (Date.now() - t0) / 1000 + 20);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save(o: FindOption) {
    await savePhrase({
      text: o.text,
      source: { kind: "find", description: text },
      dimensions: ["Expression"],
      known: { register: o.register, currency: o.currency, longVersion: text, examples: o.example ? [o.example] : [] },
      context: text,
    });
    setSaved((s) => ({ ...s, [o.text]: true }));
  }

  return (
    <Modal label="Find the phrase" onClose={onClose} width={640} align="top">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
          <IconSearch size={18} />
          <span className="eyebrow">Find the phrase</span>
        </div>
        <label htmlFor="find-text" className="sr-only">
          Describe what you mean
        </label>
        <textarea
          id="find-text"
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
          }}
          placeholder="Describe what you mean, as long as you need…  e.g. “the drink I always order every time I come here because I like it most”"
          className="input resize-none text-[17px] leading-7"
        />
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            Enter to find · Esc to close
          </span>
          <button type="button" className="btn btn-primary" onClick={run} disabled={loading || !text.trim()}>
            {loading ? "Finding…" : "Find it"}
          </button>
        </div>
        {error && (
          <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        {options && options.length === 0 && (
          <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>
            Nothing came back. Try describing it differently.
          </p>
        )}
        {options && options.length > 0 && (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {options.map((o, i) => (
              <li key={i} className="card flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xl font-semibold tracking-tight">{o.text}</span>
                  <span className="flex gap-1.5">
                    <RegisterChip value={o.register} />
                    <CurrencyChip value={o.currency} />
                  </span>
                </div>
                {o.example && (
                  <p className="m-0 text-[15px]" style={{ color: "var(--ink-2)" }}>
                    “{o.example}”
                  </p>
                )}
                {o.why && (
                  <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                    {o.why}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn btn-sm" onClick={() => save(o)} disabled={saved[o.text]}>
                    {saved[o.text] ? (
                      <>
                        <IconCheck size={16} /> Saved
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                  {onInsert && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        onInsert(o.text);
                        onClose();
                      }}
                    >
                      Use as my reply
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
