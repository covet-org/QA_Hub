import { priorityRank } from "@/lib/priority";

/**
 * Roadmap row order: anything pushed out of a release before goes first,
 * by priority within that band.
 *
 * A ticket that has already slipped once is the one most likely to slip
 * again, and on a flat list it looked identical to work that has never
 * been scheduled at all.
 *
 * Beyond those two keys this returns 0 on purpose. Array.prototype.sort is
 * stable, so equal rows keep the order buildRoadmapNodes gave them —
 * uncovered first, then priority, then id — and the part of the list this
 * rule does not speak to reads exactly as it did before. Adding a tiebreak
 * here would silently override that one.
 */
export interface OrderableTicket {
  id: string;
  /** Optional as well as nullable: roadmap fixtures omit it entirely. */
  priorityName?: string | null;
}

export function byDescopedThenPriority(
  wasDescoped: (id: string) => boolean,
): (a: OrderableTicket, b: OrderableTicket) => number {
  return (a, b) =>
    Number(wasDescoped(b.id)) - Number(wasDescoped(a.id)) ||
    priorityRank(a.priorityName) - priorityRank(b.priorityName);
}
