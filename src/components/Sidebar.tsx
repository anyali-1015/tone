"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFindPhrase } from "./FindPhrase";
import { IconNotebook, IconSearch, IconTalk, IconToday, IconWatch } from "./icons";
import { SettingsDialog } from "./SettingsDialog";

const NAV = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/watch", label: "Watch", Icon: IconWatch },
  { href: "/talk", label: "Talk", Icon: IconTalk },
  { href: "/notebook", label: "Notebook", Icon: IconNotebook },
];

export function Sidebar() {
  const pathname = usePathname();
  const { open } = useFindPhrase();
  const [settings, setSettings] = useState(false);

  return (
    <nav
      aria-label="Main"
      className="glass sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-1 border-y-0 border-l-0 px-4 py-7 md:flex"
      style={{ borderRight: "1px solid var(--hairline)" }}
    >
      <div className="px-3 pb-5 text-[22px] font-semibold tracking-tight">Tone</div>
      <button
        type="button"
        onClick={() => open()}
        className="mb-4 flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm"
        style={{ background: "var(--wash)", border: "1px solid var(--hairline)", color: "var(--muted)" }}
      >
        <span className="flex items-center gap-2">
          <IconSearch size={18} />
          Find the phrase
        </span>
        <span className="kbd">⌘K</span>
      </button>
      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline"
            style={
              active
                ? { background: "var(--accent-wash)", color: "var(--accent)", fontWeight: 600 }
                : { color: "var(--ink)" }
            }
          >
            <Icon />
            {label}
          </Link>
        );
      })}
      <div className="grow" />
      <button
        type="button"
        onClick={() => setSettings(true)}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm"
        style={{ color: "var(--muted)" }}
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{ background: "var(--chip-polite)", color: "var(--chip-polite-ink)" }}
        >
          Y
        </span>
        Settings
      </button>
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </nav>
  );
}

/** Phones: a slim top bar (search, settings) and a bottom tab bar instead of the sidebar. */
export function MobileNav() {
  const pathname = usePathname();
  const { open } = useFindPhrase();
  const [settings, setSettings] = useState(false);

  return (
    <>
      <header
        className="glass sticky top-0 z-30 flex items-center justify-between gap-3 border-x-0 border-t-0 px-4 md:hidden"
        style={{ borderBottom: "1px solid var(--hairline)", paddingTop: "max(10px, env(safe-area-inset-top))", paddingBottom: 10 }}
      >
        <div className="text-[20px] font-semibold tracking-tight">Tone</div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => open()} aria-label="Find the phrase" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ color: "var(--ink-2)" }}>
            <IconSearch size={20} />
          </button>
          <button type="button" onClick={() => setSettings(true)} aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-full">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold"
              style={{ background: "var(--chip-polite)", color: "var(--chip-polite-ink)" }}
            >
              Y
            </span>
          </button>
        </div>
      </header>
      <nav
        aria-label="Main"
        className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-x-0 border-b-0 md:hidden"
        style={{ borderTop: "1px solid var(--hairline)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] no-underline"
              style={{ color: active ? "var(--accent)" : "var(--muted)", fontWeight: active ? 600 : 500 }}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </nav>
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </>
  );
}
