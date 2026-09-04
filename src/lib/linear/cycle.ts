import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { LINEAR_TAG } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import {
  LINEAR_REVALIDATE_SECONDS,
  LinearError,
  linearConfigured,
} from "@/lib/linear/client";
import { RELEASE_NAME, releaseRank } from "@/lib/release-utils";
import { workingHoursBetween } from "@/lib/worktime";

/** One bug's total working time spent in a status. */
export interface BugStay {
  id: string;
  title: string;
  url: string;
  hours: number;
}

/** Per-priority slice of a status's cycle time. */
export interface PriorityCycle {
  priority: string; // Urgent | High | Medium | Low | No priority
  avgHours: number;
  samples: number;
  /** Individual bugs, longest stay first. */
  bugs: BugStay[];
}

/** Average working time bugs spend in one workflow status. */
export interface StatusCycle {
  status: string;
  statusType: string;
  avgHours: number;
  samples: number;
  byPriority: PriorityCycle[];
}

/** One bug's working time per status (for the per-release lists). */
export interface ReleaseBugCycle {
  id: string;
  title: string;
  url: string;
  totalHours: number;
  stays: { status: string; statusType: string; hours: number }[];
}

/** Bug cycle time for one status within one release. */
export interface ReleaseCycleStatus {
  status: string;
  statusType: string;
  /** Median of the per-bug total time spent in this status. */
  medianHours: number;
  /** Number of bugs contributing. */
  samples: number;
}

export interface ReleaseCycle {
  release: string; // "3.32"
  rank: number;
  statuses: ReleaseCycleStatus[];
  /** Every bug with history in this release, longest cycle first. */
  bugs: ReleaseBugCycle[];
}

const HISTORY_QUERY = /* GraphQL */ `
  query TicketHistory(
    $labels: [String!]!
    $since: DateTimeOrDuration!
    $after: String
  ) {
    issues(
      first: 50
      after: $after
      filter: { labels: { name: { in: $labels } }, updatedAt: { gt: $since } }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        identifier
        title
        url
        createdAt
        priority
        priorityLabel
        labels {
          nodes {
            name
          }
        }
        project {
          name
        }
        history(first: 100) {
          nodes {
            createdAt
            fromState {
              name
              type
            }
            toState {
              name
              type
            }
          }
        }
      }
    }
  }
`;

interface HistoryIssue {
  identifier: string;
  title: string;
  url: string;
  createdAt: string;
  priority: number;
  priorityLabel: string;
  labels: { nodes: { name: string }[] };
  project: { name: string } | null;
  history: {
    nodes: {
      createdAt: string;
      fromState: { name: string; type: string } | null;
      toState: { name: string; type: string } | null;
    }[];
  };
}

interface HistoryPage {
  data?: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: HistoryIssue[];
    };
  };
  errors?: { message: string }[];
}

const STATUS_TYPE_ORDER: Record<string, number> = {
  triage: 0,
  backlog: 1,
  unstarted: 2,
  started: 3,
  completed: 4,
  canceled: 5,
};

const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low", "No priority"];
const ACTIVE_PIPELINE = new Set(["triage", "backlog", "unstarted", "started"]);

/** Days of ticket history considered. */
export const CYCLE_WINDOW_DAYS = 90;
const MAX_PAGES = 8; // up to 400 tickets

/**
 * One shared fetch: every bug updated in the window, with its
 * state-change history. Both cycle dashboards aggregate from this
 * (the underlying requests are cached for 5 minutes).
 */
async function readHistoryIssues(): Promise<HistoryIssue[]> {
  const apiKey = env.linearApiKey;
  if (!apiKey) throw new LinearError("LINEAR_API_KEY is not configured");

  const since = new Date(
    Date.now() - CYCLE_WINDOW_DAYS * 86_400_000,
  ).toISOString();
  const labels = [env.bugLabel, env.csBugLabel];

  const issues: HistoryIssue[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: HISTORY_QUERY,
        variables: { labels, since, after },
      }),
      next: { revalidate: LINEAR_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      throw new LinearError(`Linear request failed: ${res.status}`);
    }
    const json = (await res.json()) as HistoryPage;
    if (json.errors?.length) {
      throw new LinearError(`Linear query failed: ${json.errors[0].message}`);
    }
    const data = json.data?.issues;
    if (!data) throw new LinearError("Linear returned no data");

    issues.push(...data.nodes);
    if (!data.pageInfo.hasNextPage) break;
    after = data.pageInfo.endCursor;
  }
  return issues;
}

/**
 * The history read, cached.
 *
 * getBugCycleStats() and getReleaseCycleStats() both need it and both run
 * on Home, so this was the single most expensive Linear query in the app
 * executed twice per page load. unstable_cache reuses it across requests
 * (the underlying fetches are POSTs, which Next's Data Cache ignores);
 * React cache() collapses the two calls within one render.
 */
const cachedHistoryIssues = unstable_cache(
  readHistoryIssues,
  ["linear-bug-history"],
  { revalidate: LINEAR_REVALIDATE_SECONDS, tags: [LINEAR_TAG] },
);

const fetchHistoryIssues = cache(cachedHistoryIssues);

/** Visit every completed stay of an issue (current status excluded). */
function forEachStay(
  issue: HistoryIssue,
  visit: (
    state: { name: string; type: string },
    startIso: string,
    endIso: string,
  ) => void,
): void {
  const changes = issue.history.nodes
    .filter((h) => h.toState)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (changes.length === 0) return;

  // Stay in the initial status: creation → first transition.
  if (changes[0].fromState) {
    visit(changes[0].fromState, issue.createdAt, changes[0].createdAt);
  }
  // Each completed stay between transitions. The current (last)
  // status is still running, so it has no end — skipped.
  for (let i = 0; i < changes.length - 1; i++) {
    visit(changes[i].toState!, changes[i].createdAt, changes[i + 1].createdAt);
  }
}

function labelNames(issue: HistoryIssue): string[] {
  return issue.labels.nodes.map((l) => l.name);
}

function isBugTicket(issue: HistoryIssue): boolean {
  const names = labelNames(issue);
  return names.includes(env.bugLabel) || names.includes(env.csBugLabel);
}

const sampleCycles: StatusCycle[] = [
  {
    status: "Todo",
    statusType: "unstarted",
    avgHours: 22,
    samples: 38,
    byPriority: [],
  },
  {
    status: "In Progress",
    statusType: "started",
    avgHours: 14,
    samples: 41,
    byPriority: [],
  },
  {
    status: "Ready for QA",
    statusType: "started",
    avgHours: 9,
    samples: 35,
    byPriority: [],
  },
  {
    status: "Merged to dev",
    statusType: "started",
    avgHours: 6,
    samples: 29,
    byPriority: [],
  },
];

interface StatusBucket {
  statusType: string;
  hours: number;
  samples: number;
  byPriority: Map<string, Map<string, BugStay>>;
  samplesByPriority: Map<string, number>;
}

/**
 * Average working time (8h days, weekends excluded) that bugs spend in
 * each workflow status over the last CYCLE_WINDOW_DAYS — broken down
 * by priority and by bug. Only completed stays count.
 */
export async function getBugCycleStats(): Promise<{
  isSample: boolean;
  cycles: StatusCycle[];
}> {
  if (!linearConfigured()) {
    return { isSample: true, cycles: sampleCycles };
  }

  try {
    const issues = (await fetchHistoryIssues()).filter(isBugTicket);
    const buckets = new Map<string, StatusBucket>();

    for (const issue of issues) {
      const priority = issue.priority > 0 ? issue.priorityLabel : "No priority";
      forEachStay(issue, (state, startIso, endIso) => {
        const hours = workingHoursBetween(startIso, endIso);
        let bucket = buckets.get(state.name);
        if (!bucket) {
          bucket = {
            statusType: state.type,
            hours: 0,
            samples: 0,
            byPriority: new Map(),
            samplesByPriority: new Map(),
          };
          buckets.set(state.name, bucket);
        }
        bucket.hours += hours;
        bucket.samples += 1;
        bucket.samplesByPriority.set(
          priority,
          (bucket.samplesByPriority.get(priority) ?? 0) + 1,
        );

        // Aggregate multiple stays of the same bug in one status.
        const bugs = bucket.byPriority.get(priority) ?? new Map();
        const stay = bugs.get(issue.identifier) ?? {
          id: issue.identifier,
          title: issue.title,
          url: issue.url,
          hours: 0,
        };
        stay.hours += hours;
        bugs.set(issue.identifier, stay);
        bucket.byPriority.set(priority, bugs);
      });
    }

    const cycles: StatusCycle[] = [...buckets.entries()]
      .map(([status, bucket]) => ({
        status,
        statusType: bucket.statusType,
        avgHours: bucket.hours / bucket.samples,
        samples: bucket.samples,
        byPriority: PRIORITY_ORDER.filter((p) => bucket.byPriority.has(p)).map(
          (priority) => {
            const bugs = [...bucket.byPriority.get(priority)!.values()].sort(
              (a, b) => b.hours - a.hours,
            );
            const totalHours = bugs.reduce((sum, b) => sum + b.hours, 0);
            const samples =
              bucket.samplesByPriority.get(priority) ?? bugs.length;
            return {
              priority,
              avgHours: totalHours / Math.max(1, samples),
              samples,
              bugs,
            };
          },
        ),
      }))
      // Need a few samples for the average to mean anything, and only
      // the active pipeline is interesting — time sitting in terminal
      // states (Done, Closed, Not a bug) isn't cycle time.
      .filter((c) => c.samples >= 3 && ACTIVE_PIPELINE.has(c.statusType))
      .sort(
        (a, b) =>
          (STATUS_TYPE_ORDER[a.statusType] ?? 9) -
            (STATUS_TYPE_ORDER[b.statusType] ?? 9) || b.samples - a.samples,
      );

    return { isSample: false, cycles };
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    console.warn(`Bug cycle stats unavailable: ${error.message}`);
    return { isSample: true, cycles: sampleCycles };
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Bug cycle time per release: for each release, the median working
 * time bugs spend in each status, plus every bug's individual time
 * per status. A bug belongs to a release via its Linear project.
 */
export async function getReleaseCycleStats(): Promise<{
  isSample: boolean;
  releases: ReleaseCycle[];
}> {
  if (!linearConfigured()) {
    return { isSample: true, releases: [] };
  }

  try {
    const issues = (await fetchHistoryIssues()).filter(isBugTicket);

    // release rank → bug id → per-status totals
    const releases = new Map<
      number,
      {
        release: string;
        bugs: Map<
          string,
          {
            id: string;
            title: string;
            url: string;
            perStatus: Map<string, { statusType: string; hours: number }>;
          }
        >;
      }
    >();

    for (const issue of issues) {
      const project = issue.project?.name;
      if (!project || !RELEASE_NAME.test(project)) continue;

      const rank = releaseRank(project);
      let entry = releases.get(rank);
      if (!entry) {
        entry = {
          release: project.match(/(\d+\.\d+)/)?.[1] ?? project,
          bugs: new Map(),
        };
        releases.set(rank, entry);
      }

      forEachStay(issue, (state, startIso, endIso) => {
        if (!ACTIVE_PIPELINE.has(state.type)) return;
        const hours = workingHoursBetween(startIso, endIso);

        let bug = entry!.bugs.get(issue.identifier);
        if (!bug) {
          bug = {
            id: issue.identifier,
            title: issue.title,
            url: issue.url,
            perStatus: new Map(),
          };
          entry!.bugs.set(issue.identifier, bug);
        }
        const stay = bug.perStatus.get(state.name) ?? {
          statusType: state.type,
          hours: 0,
        };
        stay.hours += hours;
        bug.perStatus.set(state.name, stay);
      });
    }

    const result: ReleaseCycle[] = [...releases.entries()]
      .map(([rank, entry]) => {
        // status → per-bug totals, for the medians.
        const perStatusTotals = new Map<
          string,
          { statusType: string; totals: number[] }
        >();
        const bugs: ReleaseBugCycle[] = [];

        for (const bug of entry.bugs.values()) {
          const stays = [...bug.perStatus.entries()]
            .map(([status, s]) => ({
              status,
              statusType: s.statusType,
              hours: s.hours,
            }))
            .sort(
              (a, b) =>
                (STATUS_TYPE_ORDER[a.statusType] ?? 9) -
                (STATUS_TYPE_ORDER[b.statusType] ?? 9),
            );
          if (stays.length === 0) continue;

          for (const stay of stays) {
            const bucket = perStatusTotals.get(stay.status) ?? {
              statusType: stay.statusType,
              totals: [],
            };
            bucket.totals.push(stay.hours);
            perStatusTotals.set(stay.status, bucket);
          }

          bugs.push({
            id: bug.id,
            title: bug.title,
            url: bug.url,
            totalHours: stays.reduce((sum, s) => sum + s.hours, 0),
            stays,
          });
        }

        return {
          release: entry.release,
          rank,
          statuses: [...perStatusTotals.entries()]
            .map(([status, bucket]) => ({
              status,
              statusType: bucket.statusType,
              medianHours: median(bucket.totals),
              samples: bucket.totals.length,
            }))
            .sort(
              (a, b) =>
                (STATUS_TYPE_ORDER[a.statusType] ?? 9) -
                (STATUS_TYPE_ORDER[b.statusType] ?? 9),
            ),
          bugs: bugs.sort((a, b) => b.totalHours - a.totalHours),
        };
      })
      .filter((r) => r.bugs.length > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 4);

    return { isSample: false, releases: result };
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    console.warn(`Release cycle stats unavailable: ${error.message}`);
    return { isSample: true, releases: [] };
  }
}
