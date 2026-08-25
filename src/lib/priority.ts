/**
 * Linear's priority order, and the one comparator that applies it.
 *
 * Every list of tickets in this app — bug boards, the roadmap, a
 * release's stories and bugs — reads top-down as "what needs attention
 * first", so all of them sort by priority before anything else. One
 * function so they cannot disagree about where "No priority" goes, and
 * so adding a list later does not mean re-deciding.
 *
 * Neutral module: server code sorts with it, the bug board's filter
 * renders its order.
 */
export const PRIORITY_ORDER = [
  "Urgent",
  "High",
  "Medium",
  "Low",
  "No priority",
] as const;

/** Anything unrecognised or unset sorts last, with "No priority". */
const LAST = PRIORITY_ORDER.length - 1;

export function priorityRank(name: string | null | undefined): number {
  if (!name) return LAST;
  const index = PRIORITY_ORDER.indexOf(name as (typeof PRIORITY_ORDER)[number]);
  return index === -1 ? LAST : index;
}

/**
 * Sort by priority, urgent first.
 *
 * Returns 0 for equal priorities so callers keep their own tie-breakers —
 * open before closed on a bug board, uncovered before covered on the
 * roadmap. Those secondary rules still matter; they just stop being the
 * first thing the eye lands on.
 */
export function byPriority(
  a: { priorityName?: string | null },
  b: { priorityName?: string | null },
): number {
  return priorityRank(a.priorityName) - priorityRank(b.priorityName);
}
