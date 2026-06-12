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
  query RoadmapIssues($labels: [String!]!, $after: String) {
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
        state: { name: string; type: string };
        labels: { nodes: { name: string }[] };
        project: { name: string } | null;
      }[];
    };
  };
  errors?: { message: string }[];
}

/** Fetch every issue carrying one of the QA roadmap labels. */
export async function fetchRoadmapIssues(): Promise<RoadmapTicket[]> {
  const apiKey = env.linearApiKey;
  if (!apiKey) throw new LinearError("LINEAR_API_KEY is not configured");

  const roadmapLabels = env.roadmapLabels;
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
        variables: { labels: roadmapLabels, after },
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

    const excluded = env.roadmapExcludeLabels;
    // QA's own process tickets follow the "QA <phase> | COV-x" title
    // convention but aren't always labeled "qa" consistently.
    const qaProcessTitle = /^QA\b/i;
    for (const node of issues.nodes) {
      const allLabels = node.labels.nodes.map((l) => l.name);
      // Skip QA's own process tickets even when someone puts a
      // roadmap label on them.
      if (allLabels.some((l) => excluded.includes(l))) continue;
      if (qaProcessTitle.test(node.title)) continue;
      tickets.push({
        id: node.identifier,
        title: node.title,
        url: node.url,
        status: node.state.name,
        statusType: node.state.type,
        labels: allLabels.filter((l) => roadmapLabels.includes(l)),
        project: node.project?.name ?? null,
      });
    }

    if (!issues.pageInfo.hasNextPage) break;
    after = issues.pageInfo.endCursor;
  }

  return tickets;
}
