import "server-only";

import { env } from "@/lib/env";
import {
  LINEAR_REVALIDATE_SECONDS,
  LinearError,
  linearConfigured,
} from "@/lib/linear/client";
import {
  detectDescopes,
  type DescopeEvent,
  type DescopeHistoryIssue,
} from "@/lib/linear/descope-rules";

export type { DescopeEvent } from "@/lib/linear/descope-rules";

export interface DescopeSnapshot {
  /** Keyed by release version ("3.36"), newest release first. */
  byRelease: Record<string, DescopeEvent[]>;
  /** True when Linear is not configured, so nothing could be detected. */
  unavailable: boolean;
  /** Set when Linear was configured but the history query failed. */
  error: string | null;
}

/**
 * How far back project moves are read. Descopes older than this are not
 * detected: the filter is updatedAt-based, so a feature parked in a squad
 * project and untouched since falls outside the window.
 */
export const DESCOPE_WINDOW_DAYS = 180;

const DESCOPE_QUERY = /* GraphQL */ `
  query DescopeHistory(
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
        priority
        priorityLabel
        state {
          name
          type
        }
        history(first: 100) {
          nodes {
            createdAt
            fromProject {
              name
            }
            toProject {
              name
            }
          }
        }
      }
    }
  }
`;

interface DescopePage {
  data?: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: DescopeHistoryIssue[];
    };
  };
  errors?: { message: string }[];
}

async function fetchDescopeIssues(): Promise<DescopeHistoryIssue[]> {
  const apiKey = env.linearApiKey!;
  const labels = env.roadmapLabels;
  const since = new Date(
    Date.now() - DESCOPE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const issues: DescopeHistoryIssue[] = [];
  let after: string | null = null;

  do {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: DESCOPE_QUERY,
        variables: { labels, since, after },
      }),
      next: { revalidate: LINEAR_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      throw new LinearError(
        `Linear descope query failed: ${res.status} ${res.statusText}`,
      );
    }
    const page = (await res.json()) as DescopePage;
    if (page.errors?.length) {
      throw new LinearError(
        `Linear descope query failed: ${page.errors[0].message}`,
      );
    }
    const data = page.data?.issues;
    if (!data) throw new LinearError("Linear returned no descope data");

    issues.push(...data.nodes);
    after = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
  } while (after);

  return issues;
}

/**
 * Features that left each release's scope.
 *
 * Isolated from the run and roadmap queries on purpose: this reads issue
 * history, the most expensive Linear call in the app, and a failure here
 * must not take the Releases pages down with it — hence the catch that
 * degrades to a notice.
 */
export async function getDescopeSnapshot(): Promise<DescopeSnapshot> {
  if (!linearConfigured()) {
    return { byRelease: {}, unavailable: true, error: null };
  }
  try {
    return {
      byRelease: detectDescopes(await fetchDescopeIssues()),
      unavailable: false,
      error: null,
    };
  } catch (error) {
    return {
      byRelease: {},
      unavailable: false,
      error: error instanceof Error ? error.message : "Unknown Linear error",
    };
  }
}
