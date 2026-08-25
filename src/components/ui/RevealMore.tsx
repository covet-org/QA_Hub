"use client";

import { useMemo, useState } from "react";

/**
 * How many releases a card shows before you ask for more.
 *
 * Two, because the useful comparison is the release in flight against the
 * one before it. Everything older is history you go looking for. Shared
 * so the bug trend chart and the feature breakdown cannot drift apart —
 * they are the same releases seen two ways, and a card showing three
 * beside a card showing two reads as a bug.
 */
export const DEFAULT_RELEASES_SHOWN = 2;

/**
 * "Show the newest few, reveal the rest on request."
 *
 * Returns the visible slice plus what the button needs. Callers keep
 * their own ordering — this only decides how much of it is on screen.
 */
export function useRevealMore<T>(
  items: T[],
  initial: number = DEFAULT_RELEASES_SHOWN,
): {
  visible: T[];
  expanded: boolean;
  hiddenCount: number;
  toggle: () => void;
} {
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(
    () => (expanded ? items : items.slice(0, initial)),
    [expanded, items, initial],
  );
  return {
    visible,
    expanded,
    hiddenCount: Math.max(0, items.length - initial),
    toggle: () => setExpanded((e) => !e),
  };
}

/** The affordance that goes with useRevealMore. */
export function RevealMoreButton({
  expanded,
  hiddenCount,
  onToggle,
  className = "",
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
  className?: string;
}) {
  if (hiddenCount === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-[11px] font-medium text-brand-700 hover:underline ${className}`}
    >
      {expanded ? "Show fewer" : `+ More (${hiddenCount})`}
    </button>
  );
}
