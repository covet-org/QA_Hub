import "server-only";

import { env } from "@/lib/env";
import {
  LINEAR_REVALIDATE_SECONDS,
  LinearError,
  linearConfigured,
} from "@/lib/linear/client";
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

const HISTORY_QUERY = /* GraphQL */ `
  query BugHistory($labels: [String!]!, $since: DateTimeOrDuration!, $after: String) {
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

interface HistoryPage {
  data?: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        identifier: string;
        title: string;
        url: string;
        createdAt: string;
        priority: number;
        priorityLabel: string;
        history: {
          nodes: {
            createdAt: string;
            fromState: { name: string; type: string } | null;
            toState: { name: string; type: string } | null;
          }[];
        };
      }[];
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

/** Days of bug history considered. */
export const CYCLE_WINDOW_DAYS = 90;
const MAX_PAGES = 6; // up to 300 bugs

const sampleCycles: StatusCycle[] = [
  { status: "Todo", statusType: "unstarted", avgHours: 22, samples: 38, byPriority: [] },
  { status: "In Progress", statusType: "started", avgHours: 14, samples: 41, byPriority: [] },
  { status: "Ready for QA", statusType: "started", avgHours: 9, samples: 35, byPriority: [] },
  { status: "Merged to dev", statusType: "started", avgHours: 6, samples: 29, byPriority: [] },
];

interface StatusBucket {
  statusType: string;
  hours: number;
  samples: number;
  /** key: priority → (key: bug id → stay) */
  byPriority: Map<string, Map<string, BugStay>>;
  samplesByPriority: Map<string, number>;
}

/**
 * Average working time (8h days, weekends excluded) that bugs spend in
 * each workflow status, from Linear's state-change history over the
 * last CYCLE_WINDOW_DAYS — broken down by priority and by bug. Only
 * completed stays count; time still sitting in the current status is
 * not.
 */
export async function getBugCycleStats(): Promise<{
  isSample: boolean;
  cycles: StatusCycle[];
}> {
  if (!linearConfigured()) {
    return { isSample: true, cycles: sampleCycles };
  }

  try {
    const apiKey = env.linearApiKey!;
    const since = new Date(
      Date.now() - CYCLE_WINDOW_DAYS * 86_400_000,
    ).toISOString();
    const labels = [env.bugLabel, env.csBugLabel];

    const buckets = new Map<string, StatusBucket>();

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
      const issues = json.data?.issues;
      if (!issues) throw new LinearError("Linear returned no data");

      for (const issue of issues.nodes) {
        const changes = issue.history.nodes
          .filter((h) => h.toState)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (changes.length === 0) continue;

        const priority =
          issue.priority > 0 ? issue.priorityLabel : "No priority";

        const record = (
          state: { name: string; type: string },
          startIso: string,
          endIso: string,
        ) => {
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
        };

        // Stay in the initial status: creation → first transition.
        if (changes[0].fromState) {
          record(changes[0].fromState, issue.createdAt, changes[0].createdAt);
        }
        // Each completed stay between transitions. The current (last)
        // status is still running, so it has no end — skipped.
        for (let i = 0; i < changes.length - 1; i++) {
          record(
            changes[i].toState!,
            changes[i].createdAt,
            changes[i + 1].createdAt,
          );
        }
      }

      if (!issues.pageInfo.hasNextPage) break;
      after = issues.pageInfo.endCursor;
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
            const samples = bucket.samplesByPriority.get(priority) ?? bugs.length;
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
      .filter(
        (c) =>
          c.samples >= 3 &&
          ["triage", "backlog", "unstarted", "started"].includes(c.statusType),
      )
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
