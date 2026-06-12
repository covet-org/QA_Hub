import "server-only";

import { env } from "@/lib/env";
import {
  LINEAR_REVALIDATE_SECONDS,
  LinearError,
  linearConfigured,
} from "@/lib/linear/client";
import { workingHoursBetween } from "@/lib/worktime";

/** Average working time bugs spend in one workflow status. */
export interface StatusCycle {
  status: string;
  statusType: string;
  avgHours: number;
  samples: number;
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
        createdAt
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
        createdAt: string;
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

/** Days of bug history considered. */
export const CYCLE_WINDOW_DAYS = 90;
const MAX_PAGES = 6; // up to 300 bugs

const sampleCycles: StatusCycle[] = [
  { status: "Todo", statusType: "unstarted", avgHours: 22, samples: 38 },
  { status: "In Progress", statusType: "started", avgHours: 14, samples: 41 },
  { status: "Ready for QA", statusType: "started", avgHours: 9, samples: 35 },
  { status: "Merged to dev", statusType: "started", avgHours: 6, samples: 29 },
];

/**
 * Average working time (8h days, weekends excluded) that bugs spend in
 * each workflow status, from Linear's state-change history over the
 * last CYCLE_WINDOW_DAYS. Only completed stays count — the time a bug
 * is still sitting in its current status is not.
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

    const sums = new Map<
      string,
      { statusType: string; hours: number; samples: number }
    >();

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

        // Stay in the initial status: creation → first transition.
        const record = (
          state: { name: string; type: string },
          startIso: string,
          endIso: string,
        ) => {
          const hours = workingHoursBetween(startIso, endIso);
          const entry = sums.get(state.name) ?? {
            statusType: state.type,
            hours: 0,
            samples: 0,
          };
          entry.hours += hours;
          entry.samples += 1;
          sums.set(state.name, entry);
        };

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

    const cycles = [...sums.entries()]
      .map(([status, s]) => ({
        status,
        statusType: s.statusType,
        avgHours: s.hours / s.samples,
        samples: s.samples,
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
