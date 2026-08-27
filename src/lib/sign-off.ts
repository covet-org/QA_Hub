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
 * stores a linked message as an issue *attachment* whose URL carries the
 * channel id and whose subtitle carries the message text, e.g.
 *   https://covetglobal.slack.com/archives/C0ADVLJBUCE/p178526...
 *   "hi guys @qa this ticket are merged"
 *
 * Two filters, because either one alone is wrong:
 *
 *   channel — COV-7719 carries a thread from C06B08L2Q77, another channel
 *             entirely, so "has a Slack link" is not sign-off.
 *   wording — any team tagging a ticket in the right channel produces the
 *             same attachment. A confirmation is a dev SAYING it is merged,
 *             so the message text has to say so.
 *
 * The wording test is a heuristic and is treated as one: a thread that
 * fails it is reported as "linked, no merge note" with its text one click
 * away, never silently dropped. Phrases are configurable, so the team can
 * widen them without a deploy, and negations ("not merged yet") are
 * rejected rather than counted.
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

/** A Slack message linked to the issue from the sign-off channel. */
export interface SlackThread {
  url: string;
  /** Linear titles these "Message from <person>". */
  title: string;
  /** The message text, as Linear captured it. */
  subtitle: string | null;
  at: string | null;
  /**
   * The phrase that made this read as a merge confirmation, or null when
   * the message only mentions the ticket. Shown on the row, so the call is
   * auditable rather than taken on trust.
   */
  matched: string | null;
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
  /** The message that confirms the merge, when one qualifies. */
  slack: SlackThread | null;
  /**
   * Messages from the channel that mention the ticket without confirming a
   * merge. Kept so "nobody posted" and "somebody posted something else" are
   * different rows — collapsing them is how a board starts lying.
   */
  mentions: SlackThread[];
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
  /**
   * Lower-case phrases that make a message a merge confirmation, e.g.
   * ["merged", "mergeado"]. Configurable so wording can be widened without
   * a deploy.
   */
  confirmPhrases: string[];
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

/**
 * "not merged", "will be merged", "before merging" — a message about a
 * merge that has NOT happened. Checked in the few words before the phrase,
 * because "this is not merged yet" must never read as confirmation.
 */
const NEGATORS =
  /(?:\bnot\b|\bno\b|\bisn'?t\b|\baren'?t\b|\bwon'?t\b|\bwill\b|\bto\s+be\b|\bbefore\b|\bpending\b|\bwaiting\b|\bonce\b|\bafter\b|\bwhen\b)[^.!?]{0,20}$/i;

/**
 * The phrase confirming a merge, or null when the text does not claim one.
 *
 * Matches on the message Linear captured, looking only at whether a
 * non-negated confirm phrase appears. Deliberately dumb: a cleverer parser
 * would be harder to predict, and the row shows the matched phrase so a
 * wrong call is visible instead of buried.
 */
export function matchConfirmPhrase(
  text: string | null | undefined,
  phrases: string[],
): string | null {
  // A missing phrase list fails CLOSED: nothing reads as confirmed, so a
  // misconfiguration shows as a wall of unconfirmed rows rather than as a
  // gate everyone passes.
  if (!text || !Array.isArray(phrases)) return null;
  const haystack = text.toLowerCase();
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      const before = haystack.slice(Math.max(0, at - 40), at);
      if (!NEGATORS.test(before)) return phrase;
      from = at + needle.length;
    }
  }
  return null;
}

function readThreads(
  issue: SignOffHistoryIssue,
  channelId: string,
  confirmPhrases: string[],
): { slack: SlackThread | null; mentions: SlackThread[] } {
  const threads: SlackThread[] = issue.attachments.nodes
    .filter((a) => a.url.includes(channelId))
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
    .map((a) => ({
      url: a.url,
      title: a.title ?? "Slack message",
      subtitle: a.subtitle ?? null,
      at: a.createdAt ?? null,
      // The title carries "Message from <person>", so the text is where the
      // claim lives; the title is checked too in case Linear ever puts the
      // message there instead.
      matched:
        matchConfirmPhrase(a.subtitle, confirmPhrases) ??
        matchConfirmPhrase(a.title, confirmPhrases),
    }));

  return {
    slack: threads.find((t) => t.matched !== null) ?? null,
    mentions: threads.filter((t) => t.matched === null),
  };
}

export function buildSignOffBoard({
  issues,
  channelId,
  channelName,
  mergedStatus,
  syncSince,
  confirmPhrases,
}: SignOffInput): SignOffStory[] {
  const rows = issues.map((issue): SignOffStory => {
    const mergedAt = firstEntry(issue, mergedStatus);
    // Current status counts too: history is fetched with a cap, so an old
    // story whose merge fell off the end must not read as never merged.
    const isMerged = mergedAt !== null || issue.state.name === mergedStatus;
    const { slack, mentions } = readThreads(issue, channelId, confirmPhrases);

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
        note =
          mentions.length > 0
            ? `reached Merged to dev; ${mentions.length} message${mentions.length === 1 ? "" : "s"} from #${channelName} mention this ticket but none says it was merged`
            : `reached Merged to dev with no message from #${channelName} linked in Linear`;
      }
    } else if (slack) {
      state = "unmerged-confirmed";
      note = `a merge was confirmed in #${channelName}, but the ticket is not at Merged to dev (currently ${issue.state.name})`;
    } else {
      state = "unmerged-unconfirmed";
      note =
        mentions.length > 0
          ? `not at Merged to dev (currently ${issue.state.name}); mentioned in #${channelName} but never confirmed as merged`
          : `not at Merged to dev (currently ${issue.state.name}) and no message from #${channelName} linked`;
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
      mentions,
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
