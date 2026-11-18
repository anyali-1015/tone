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
      className="glass sticky top-0 flex h-screen w-[232px] shrink-0 flex-col gap-1 border-y-0 border-l-0 px-4 py-7"
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
