import "server-only";

import { env } from "@/lib/env";
import type { RoadmapTicket } from "@/lib/linear/types";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

/** How long Linear responses are cached server-side (seconds). */
export const LINEAR_REVALIDATE_SECONDS = 300;

export class LinearError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearError";
  }
}

export function linearConfigured(): boolean {
  return Boolean(env.linearApiKey);
}

const ISSUES_QUERY = /* GraphQL */ `
  query IssuesByLabels($labels: [String!]!, $after: String) {
    issues(
      first: 100
      after: $after
      filter: { labels: { name: { in: $labels } } }
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
        labels {
          nodes {
            name
          }
        }
        project {
          name
        }
      }
    }
  }
`;

interface IssuesPage {
  data?: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        identifier: string;
        title: string;
        url: string;
        priority: number;
        priorityLabel: string;
        state: { name: string; type: string };
        labels: { nodes: { name: string }[] };
        project: { name: string } | null;
      }[];
    };
  };
  errors?: { message: string }[];
}

/** Fetch every issue carrying any of the given labels (all pages). */
export async function fetchIssuesWithLabels(
  labels: string[],
): Promise<RoadmapTicket[]> {
  const apiKey = env.linearApiKey;
  if (!apiKey) throw new LinearError("LINEAR_API_KEY is not configured");

  const tickets: RoadmapTicket[] = [];
  let after: string | null = null;

  for (;;) {
    const res = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ISSUES_QUERY,
        variables: { labels, after },
      }),
      next: { revalidate: LINEAR_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      throw new LinearError(`Linear request failed: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as IssuesPage;
    if (page.errors?.length) {
      throw new LinearError(`Linear query failed: ${page.errors[0].message}`);
    }
    const issues = page.data?.issues;
    if (!issues) throw new LinearError("Linear returned no data");

    for (const node of issues.nodes) {
      const allLabels = node.labels.nodes.map((l) => l.name);
      tickets.push({
        id: node.identifier,
        title: node.title,
        url: node.url,
        status: node.state.name,
        statusType: node.state.type,
        labels: allLabels.filter((l) => labels.includes(l)),
        project: node.project?.name ?? null,
        priorityName: node.priority > 0 ? node.priorityLabel : null,
        allLabels,
      });
    }

    if (!issues.pageInfo.hasNextPage) break;
    after = issues.pageInfo.endCursor;
  }

  return tickets;
}

/** Roadmap tickets: the roadmap labels minus QA's own process tickets. */
export async function fetchRoadmapIssues(): Promise<RoadmapTicket[]> {
  const all = await fetchIssuesWithLabels(env.roadmapLabels);
  const excluded = env.roadmapExcludeLabels;
  // QA's own process tickets follow the "QA <phase> | COV-x" title
  // convention but aren't always labeled "qa" consistently.
  const qaProcessTitle = /^QA\b/i;

  return all.filter(
    (ticket) =>
      !qaProcessTitle.test(ticket.title) &&
      !(ticket.allLabels ?? ticket.labels).some((l) => excluded.includes(l)),
  );
}
