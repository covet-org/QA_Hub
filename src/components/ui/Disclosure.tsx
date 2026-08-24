"use client";

import { useState } from "react";

/** Shared chevron. Four copies of this existed before the library. */
export function Chevron({
  open,
  /** Size and colour, so the dark sidebar can use the same component. */
  className = "size-4 text-slate-400",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${className}`}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

/**
 * A collapsible section on its own card surface: title on the left,
 * summary and chevron on the right.
 *
 * Used by the roadmap board, the bug board and anywhere else a group of
 * rows folds away. Six hand-rolled versions of this existed, each with
 * its own padding and hover behaviour.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  /** Right-hand summary — counts, meters, tags. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken"
      >
        <h2 className="font-display flex items-center gap-2 text-sm font-semibold text-slate-800">
          {title}
        </h2>
        <span className="flex items-center gap-3">
          {summary}
          <Chevron open={open} />
        </span>
      </button>
      {open && <div className="border-t border-hairline">{children}</div>}
    </section>
  );
}

/**
 * A disclosure that is a row inside an existing card, rather than its own
 * card — the "Show failed / blocked / skipped" pattern on run cards.
 *
 * Takes its open state from the caller, because those panels load their
 * content on first open and the caller owns that fetch.
 */
export function DisclosureRow({
  label,
  open,
  onToggle,
  children,
}: {
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-hairline">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-2.5 text-left text-xs font-medium text-brand-700 transition-colors hover:bg-surface-sunken"
      >
        {label}
      </button>
      {open && children}
    </div>
  );
}
