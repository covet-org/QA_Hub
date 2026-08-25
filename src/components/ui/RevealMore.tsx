"use client";

import { useMemo, useState } from "react";

/**
 * Shared so the trend charts, the feature breakdown and Home's links
 * cannot drift apart — they are the same releases seen three ways.
 * Defined in lib/release-window.ts because Home is a server component and
 * cannot import a value through this client module.
 */
export { DEFAULT_RELEASES_SHOWN } from "@/lib/release-window";
import { DEFAULT_RELEASES_SHOWN } from "@/lib/release-window";

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
