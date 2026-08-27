import { byPriority } from "@/lib/priority";

/**
 * The design sign-off gate for Cross-Product stories.
 *
 * A Medium/Big feature or Quick win is only properly through design when
 * BOTH are true: it reached "Merged to dev" in Linear, and it was presented
 * in writing in #4-squad-cross-product on Slack. This turns the pair into
 * one verdict per story so the gap — merged with no written confirmation —
 * is a row you can see rather than something you reconstruct by hand.
 *
 * The Slack half is real data, not a guess: Linear's Slack integration
 * stores a shared thread as an issue *attachment* whose URL carries the
 * channel id, e.g.
 *   https://covetglobal.slack.com/archives/C0ADVLJBUCE/p178526...
 * so a confirmation is detected by channel id rather than by reading the
 * message text. COV-7719 already carries one from a different channel
 * (C06B08L2Q77), which is exactly why the channel has to be matched and
 * not merely the presence of "a Slack link".
 *
 * Traceability starts when the sync does. A story merged before that date
 * cannot have an attachment however well it was presented, so it reads as
 * "predates the Slack sync" instead of being accused of a missing sign-off.
 *
 * Pure: no I/O, so the gate is testable without keys.
 */

/**
 * The two facts, crossed. Each name says which half holds, so a row can be
 * read without knowing the rules: no interpretation, no verdict word that
 * has to be looked up.
 */
export type SignOffState =
  | "merged-unconfirmed"
  | "unmerged-unconfirmed"
  | "unmerged-confirmed"
  | "merged-confirmed"
  | "predates-sync";

/** A Slack thread linked to the issue from the sign-off channel. */
export interface SlackConfirmation {
  url: string;
  /** Linear titles these "Message from <person>". */
  title: string;
  /** The message text, as Linear captured it. */
  subtitle: string | null;
  at: string | null;
}

export interface SignOffStory {
  id: string;
  title: string;
  url: string;
  priorityName: string | null;
  status: string;
  statusType: string;
  labels: string[];
  /** True once it has ever reached the merged status. */
  isMerged: boolean;
  /** When it FIRST reached it, or null when history does not show it. */
  mergedAt: string | null;
  slack: SlackConfirmation | null;
  state: SignOffState;
  /** The verdict in words, for the row. */
  note: string;
}

/** The issue shape the Linear query returns. */
export interface SignOffHistoryIssue {
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  state: { name: string; type: string };
  labels: { nodes: { name: string }[] };
  history: {
    nodes: { createdAt: string; toState: { name: string } | null }[];
  };
  attachments: {
    nodes: {
      title: string | null;
      subtitle: string | null;
      url: string;
      createdAt?: string | null;
    }[];
  };
}

export interface SignOffInput {
  issues: SignOffHistoryIssue[];
  /** Slack channel id that counts as sign-off, e.g. "C0ADVLJBUCE". */
  channelId: string;
  /** For the copy only. */
  channelName: string;
  /** Linear status that counts as merged, e.g. "Merged to dev". */
  mergedStatus: string;
  /** ISO date the Slack↔Linear sync began; earlier merges are exempt. */
  syncSince: string;
}

/**
 * Ordered by how far the story is from the gate, worst first: the one
 * violation leads, then neither step done, then the half that is correctly
 * sequenced, then through, and finally the history the sync cannot cover —
 * neither a problem nor an achievement.
 */
const STATE_RANK: Record<SignOffState, number> = {
  "merged-unconfirmed": 0,
  "unmerged-unconfirmed": 1,
  "unmerged-confirmed": 2,
  "merged-confirmed": 3,
  "predates-sync": 4,
};

/**
 * The status name is written out exactly as Linear spells it. The gate is
 * only a source of truth if its labels name states that actually exist —
 * "Merged in dev" would be a status nobody can find in Linear.
 */
export const STATE_LABEL: Record<SignOffState, string> = {
  "merged-unconfirmed": "Merged to dev · not confirmed",
  "unmerged-unconfirmed": "Not merged · not confirmed",
  "unmerged-confirmed": "Not merged · confirmed",
  "merged-confirmed": "Merged to dev · confirmed",
  "predates-sync": "Merged to dev · before Slack sync",
};

function firstEntry(issue: SignOffHistoryIssue, status: string): string | null {
  const stamps = issue.history.nodes
    .filter((h) => h.toState?.name === status)
    .map((h) => h.createdAt)
    .sort();
  // The FIRST entry: a story that bounced back and was merged again was
  // still merged on the earlier date, and that is the date the gate cares
  // about. COV-7719 entered "Merged to dev" twice.
  return stamps[0] ?? null;
}

function findSlack(
  issue: SignOffHistoryIssue,
  channelId: string,
): SlackConfirmation | null {
  const hits = issue.attachments.nodes
    .filter((a) => a.url.includes(channelId))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const first = hits[0];
  if (!first) return null;
  return {
    url: first.url,
    title: first.title ?? "Slack thread",
    subtitle: first.subtitle ?? null,
    at: first.createdAt ?? null,
  };
}

export function buildSignOffBoard({
  issues,
  channelId,
  channelName,
  mergedStatus,
  syncSince,
}: SignOffInput): SignOffStory[] {
  const rows = issues.map((issue): SignOffStory => {
    const mergedAt = firstEntry(issue, mergedStatus);
    // Current status counts too: history is fetched with a cap, so an old
    // story whose merge fell off the end must not read as never merged.
    const isMerged = mergedAt !== null || issue.state.name === mergedStatus;
    const slack = findSlack(issue, channelId);

    let state: SignOffState;
    let note: string;
    if (isMerged && slack) {
      state = "merged-confirmed";
      note = `through the gate: reached Merged to dev and a thread from #${channelName} is linked`;
    } else if (isMerged) {
      if (mergedAt !== null && mergedAt < syncSince) {
        state = "predates-sync";
        note = `reached Merged to dev before #${channelName} was synced to Linear, so no linked thread can be expected`;
      } else {
        state = "merged-unconfirmed";
        note = `reached Merged to dev with no thread from #${channelName} linked in Linear`;
      }
    } else if (slack) {
      state = "unmerged-confirmed";
      note = `a thread from #${channelName} is linked; not at Merged to dev yet (currently ${issue.state.name})`;
    } else {
      state = "unmerged-unconfirmed";
      note = `not at Merged to dev (currently ${issue.state.name}) and no thread from #${channelName} linked`;
    }

    return {
      id: issue.identifier,
      title: issue.title,
      url: issue.url,
      priorityName: issue.priority > 0 ? issue.priorityLabel : null,
      status: issue.state.name,
      statusType: issue.state.type,
      labels: issue.labels.nodes.map((l) => l.name),
      isMerged,
      mergedAt,
      slack,
      state,
      note,
    };
  });

  return rows.sort(
    (a, b) =>
      STATE_RANK[a.state] - STATE_RANK[b.state] ||
      byPriority(a, b) ||
      a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
}

/** Counts for the page header, in the order the board sorts. */
export function countByState(
  rows: SignOffStory[],
): { state: SignOffState; count: number }[] {
  return (Object.keys(STATE_RANK) as SignOffState[])
    .map((state) => ({
      state,
      count: rows.filter((r) => r.state === state).length,
    }))
    .filter((entry) => entry.count > 0);
}
