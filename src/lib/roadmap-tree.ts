import type { CoveredTicket, ParentRef, RoadmapNode } from "./linear/types";
import { byPriority } from "./priority";

/**
 * Turns a flat release group into parent rows with their sub-issues
 * nested underneath. Pure (no I/O) so it is shared by the server page
 * and the client board.
 *
 * Rules, all deliberate:
 * - Nesting happens INSIDE a release group; a ticket never moves to
 *   another group because of its parent. A parent spanning two releases
 *   therefore shows up in both, each time with only that release's
 *   sub-issues under it.
 * - A parent that carries no roadmap label is still drawn (otherwise its
 *   sub-issues would look parentless), but flagged `contextOnly` so the
 *   coverage stats stay "roadmap-labeled tickets only".
 * - Chains deeper than one level are flattened onto their top-most
 *   in-group ancestor: one indent level, nothing hidden.
 */
export function buildRoadmapNodes(
  tickets: CoveredTicket[],
  /** Builds the row for a parent that isn't itself a roadmap ticket. */
  contextTicket: (parent: ParentRef) => CoveredTicket,
): RoadmapNode[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const childrenOf = new Map<string, CoveredTicket[]>();
  const contextRefs = new Map<string, ParentRef>();
  const rootIds: string[] = [];
  const seenRoot = new Set<string>();

  const addRoot = (id: string) => {
    if (seenRoot.has(id)) return;
    seenRoot.add(id);
    rootIds.push(id);
  };
  const addChild = (parentId: string, ticket: CoveredTicket) => {
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), ticket]);
  };

  for (const ticket of tickets) {
    const attach = resolveParent(ticket, byId);
    if (!attach) {
      addRoot(ticket.id);
      continue;
    }
    if (attach.context) contextRefs.set(attach.parentId, attach.context);
    addRoot(attach.parentId);
    addChild(attach.parentId, ticket);
  }

  const nodes: RoadmapNode[] = rootIds.map((id) => {
    const own = byId.get(id);
    const ref = contextRefs.get(id);
    const ticket = own ?? (ref ? contextTicket(ref) : null);
    // Unreachable: every root id is either a ticket or a context ref.
    if (!ticket) throw new Error(`roadmap tree: no data for row ${id}`);
    return {
      ticket,
      contextOnly: !own,
      children: (childrenOf.get(id) ?? []).slice().sort(byCoverageThenId),
    };
  });

  return nodes.sort(
    (a, b) =>
      Number(nodeFullyCovered(a)) - Number(nodeFullyCovered(b)) ||
      byPriority(a.ticket, b.ticket) ||
      compareIds(a.ticket.id, b.ticket.id),
  );
}

/**
 * Uncovered first, urgent first within that, then by identifier.
 *
 * The tree sorts again after the snapshot does, so the rule has to live
 * here too: sorting the flat ticket list was not enough, and the board
 * quietly showed ticket-id order until someone read it closely.
 */
function byCoverageThenId(a: CoveredTicket, b: CoveredTicket): number {
  return (
    Number(a.hasTestCases) - Number(b.hasTestCases) ||
    byPriority(a, b) ||
    compareIds(a.id, b.id)
  );
}

/**
 * COV-9 before COV-12. Plain localeCompare puts "12" before "9" because
 * it compares character by character.
 */
function compareIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * The tickets a row is accountable for: its sub-issues, plus itself when
 * it is a roadmap ticket rather than a context-only parent.
 */
export function countedTickets(node: RoadmapNode): CoveredTicket[] {
  return node.contextOnly ? node.children : [node.ticket, ...node.children];
}

/** How many of a row's counted tickets have Testiny cases. */
export function nodeCoverage(node: RoadmapNode): {
  counted: number;
  covered: number;
} {
  const counted = countedTickets(node);
  return {
    counted: counted.length,
    covered: counted.filter((t) => t.hasTestCases).length,
  };
}

function nodeFullyCovered(node: RoadmapNode): boolean {
  const { counted, covered } = nodeCoverage(node);
  return counted > 0 && counted === covered;
}

interface Attachment {
  /** Identifier of the row this ticket nests under. */
  parentId: string;
  /** Set when that row is not itself a roadmap ticket in this group. */
  context: ParentRef | null;
}

/**
 * Where a ticket should hang: its top-most ancestor inside the group, or
 * the nearest ancestor outside it (drawn as a context row). Null means
 * the ticket is a root — including when its parent is known only by id,
 * since there is nothing to draw a parent row from.
 */
function resolveParent(
  ticket: CoveredTicket,
  byId: Map<string, CoveredTicket>,
): Attachment | null {
  let cur = ticket;
  const seen = new Set<string>([ticket.id]);

  for (;;) {
    const parentId = cur.parent?.id ?? cur.parentId ?? null;
    if (!parentId || seen.has(parentId)) break; // root, or a parent cycle
    const inGroup = byId.get(parentId);
    if (!inGroup) {
      const context = cur.parent ?? null;
      // Parent known by id only (older fixtures): nothing to draw.
      if (!context) break;
      return { parentId, context };
    }
    seen.add(parentId);
    cur = inGroup;
  }

  return cur.id === ticket.id ? null : { parentId: cur.id, context: null };
}
