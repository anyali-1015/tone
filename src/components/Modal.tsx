"use client";

import { useEffect, useRef } from "react";

/** A glass panel over a dimmed page. Esc or a click outside closes it. */
export function Modal({
  label,
  onClose,
  children,
  width = 560,
  align = "center",
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  align?: "center" | "top";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[autofocus], textarea, input, button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center px-3 md:px-4 ${align === "top" ? "items-start pt-[max(16px,env(safe-area-inset-top))] md:pt-[14vh]" : "items-center"}`}
      style={{ background: "rgba(20,20,24,0.18)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="rise w-full overflow-auto rounded-3xl"
        style={{
          maxWidth: width,
          maxHeight: "min(80vh, calc(100dvh - 32px))",
          background: "var(--glass-strong)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
