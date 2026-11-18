"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { RegisterChip, TypeChip } from "@/components/chips";
import { IconPlus, IconTalk, IconWatch } from "@/components/icons";
import { applyFilter, collections, type Filter } from "@/lib/collections";
import { db, uid } from "@/lib/db";

export default function NotebookPage() {
  const [active, setActive] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [newList, setNewList] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const [phrases, lists] = await Promise.all([db.phrases.orderBy("createdAt").reverse().toArray(), db.lists.toArray()]);
    return { phrases, lists, now: Date.now() };
  }, []);

  const cols = useMemo(() => collections(data?.lists ?? []), [data?.lists]);
  const now = data?.now ?? 0;
  const col = cols.find((c) => c.key === active) ?? cols[0];
  const inCol = (data?.phrases ?? []).filter(col.test);
  const due = inCol.filter((p) => p.srs.due <= now).length;
  const allDue = (data?.phrases ?? []).filter((p) => p.srs.due <= now).length;
  const q = query.trim().toLowerCase();
  const shown = inCol.filter(
    (p) => applyFilter(p, filter, now) && (!q || p.text.toLowerCase().includes(q) || p.meaning.toLowerCase().includes(q) || p.longVersion.toLowerCase().includes(q)),
  );

  async function createList() {
    const name = newList?.trim();
    if (!name) return;
    const id = uid();
    await db.lists.add({ id, name, createdAt: Date.now() });
    setNewList(null);
    setActive(`list:${id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[32px] leading-10 font-semibold tracking-tight">Notebook</h1>
          <p className="m-0 text-[15px]" style={{ color: "var(--muted)" }}>
            {data?.phrases.length ?? 0} phrases saved
          </p>
        </div>
        <Link
          href="/review"
          className="btn btn-primary min-h-12 px-6 text-base"
          aria-disabled={allDue === 0}
          style={allDue === 0 ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        >
          Review now ({allDue} due)
        </Link>
      </header>

      <div className="flex flex-wrap items-start gap-8">
        <nav aria-label="Collections" className="flex w-[220px] shrink-0 flex-col gap-0.5">
          {cols.map((c, idx) => {
            const header = c.group && c.group !== cols[idx - 1]?.group ? c.group : null;
            const count = (data?.phrases ?? []).filter(c.test).length;
            return (
              <div key={c.key} className="flex flex-col">
                {header && <p className="eyebrow m-0 mt-4 mb-1 px-3">{header}</p>}
                <button
                  type="button"
                  aria-current={active === c.key ? "true" : undefined}
                  onClick={() => setActive(c.key)}
                  className="flex min-h-10 items-center justify-between rounded-xl px-3 text-left text-[15px]"
                  style={active === c.key ? { background: "var(--accent-wash)", color: "var(--accent)", fontWeight: 600 } : { color: "var(--ink)" }}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                    {count}
                  </span>
                </button>
              </div>
            );
          })}
          {newList === null ? (
            <button type="button" className="mt-2 flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm" style={{ color: "var(--muted)" }} onClick={() => setNewList("")}>
              <IconPlus size={16} /> New list
            </button>
          ) : (
            <form
              className="mt-2 flex gap-1.5 px-1"
              onSubmit={(e) => {
                e.preventDefault();
                void createList();
              }}
            >
              <label htmlFor="new-list" className="sr-only">
                List name
              </label>
              <input id="new-list" autoFocus className="input min-h-9 py-1 text-sm" placeholder="List name" value={newList} onChange={(e) => setNewList(e.target.value)} onBlur={() => !newList && setNewList(null)} />
            </form>
          )}
        </nav>

        <section className="flex min-w-0 flex-1 flex-col gap-4" aria-label={col.name}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold">{col.name}</h2>
              <p className="m-0 text-[13px]" style={{ color: "var(--muted)" }}>
                {inCol.length} phrases · {due} due
              </p>
            </div>
            {inCol.length > 0 && (
              <Link href={`/review?c=${encodeURIComponent(col.key)}&all=1`} className="btn btn-sm">
                Review this collection
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="nb-search" className="sr-only">
              Search phrases
            </label>
            <input id="nb-search" className="input max-w-[320px]" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="seg" role="group" aria-label="Filter">
              {(
                [
                  ["all", "All"],
                  ["due", "Due"],
                  ["mastered", "Mastered"],
                  ["used", "Used in real life"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {data && data.phrases.length === 0 && (
            <div className="card flex flex-col gap-2 p-6">
              <p className="m-0 font-semibold">Nothing saved yet</p>
              <p className="m-0 text-sm" style={{ color: "var(--muted)" }}>
                Save phrases from a conversation&apos;s rewrites, from a video&apos;s transcript, or with ⌘K Find the phrase.
              </p>
            </div>
          )}

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {shown.map((p) => (
              <li key={p.id}>
                <Link href={`/notebook/${p.id}`} className="card flex items-center justify-between gap-4 px-5 py-3.5 no-underline" style={{ color: "var(--ink)" }}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[16px] font-semibold">{p.text}</span>
                    {p.meaning && (
                      <span className="truncate text-[13px]" style={{ color: "var(--muted)" }}>
                        {p.meaning}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2" style={{ color: "var(--muted)" }}>
                    <TypeChip value={p.type} />
                    <RegisterChip value={p.register} />
                    <span aria-label={p.source.kind === "video" ? "From a video" : "From a conversation"}>
                      {p.source.kind === "video" ? <IconWatch size={16} /> : <IconTalk size={16} />}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
