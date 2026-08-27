import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
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

const issuesQuery = (filter: string) => /* GraphQL */ `
  query Issues($keys: [String!]!, $after: String) {
    issues(first: 100, after: $after, filter: ${filter}) {
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
        state {
          name
          type
        }
        assignee {
          name
          displayName
        }
        labels {
          nodes {
            name
          }
        }
        project {
          name
        }
        parent {
          identifier
          title
          url
          priority
          priorityLabel
          state {
            name
            type
          }
          project {
            name
          }
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
        createdAt: string;
        priority: number;
        priorityLabel: string;
        state: { name: string; type: string };
        assignee: { name: string; displayName: string | null } | null;
        labels: { nodes: { name: string }[] };
        project: { name: string } | null;
        parent: {
          identifier: string;
          title: string;
          url: string;
          priority: number;
          priorityLabel: string;
          state: { name: string; type: string };
          project: { name: string } | null;
        } | null;
      }[];
    };
  };
  errors?: { message: string }[];
}

/**
 * Fetch every issue carrying any of the given labels (all pages).
 *
 * Wrapped below so the roadmap and both bug boards share one read per
 * label set. Keyed by a joined string rather than the array itself:
 * React cache() compares arguments by identity, and every caller builds
 * a fresh array.
 */
async function readIssues(
  query: string,
  keys: string[],
  /**
   * Labels to keep on each ticket for display. Null keeps every label,
   * which is what the project query wants: an issue in a release is
   * content regardless of how it happens to be tagged.
   */
  displayLabels: string[] | null,
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
        query,
        variables: { keys, after },
      }),
      next: { revalidate: LINEAR_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      throw new LinearError(
        `Linear request failed: ${res.status} ${res.statusText}`,
      );
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
        createdAt: node.createdAt,
        title: node.title,
        url: node.url,
        status: node.state.name,
        statusType: node.state.type,
        labels: displayLabels
          ? allLabels.filter((l) => displayLabels.includes(l))
          : allLabels,
        project: node.project?.name ?? null,
        priorityName: node.priority > 0 ? node.priorityLabel : null,
        // `name` is the full name; `displayName` is the short handle
        // ("aurbano"). Prefer the full name so bug assignees read like the
        // Testiny ones on the Releases pages.
        assigneeName: node.assignee?.name || node.assignee?.displayName || null,
        parentId: node.parent?.identifier ?? null,
        parent: node.parent
          ? {
              id: node.parent.identifier,
              title: node.parent.title,
              url: node.parent.url,
              status: node.parent.state.name,
              statusType: node.parent.state.type,
              priorityName:
                node.parent.priority > 0 ? node.parent.priorityLabel : null,
              project: node.parent.project?.name ?? null,
            }
          : null,
        allLabels,
      });
    }

    if (!issues.pageInfo.hasNextPage) break;
    after = issues.pageInfo.endCursor;
  }

  return tickets;
}

const ISSUES_BY_LABEL_QUERY = issuesQuery(
  "{ labels: { name: { in: $keys } } }",
);
const ISSUES_BY_PROJECT_QUERY = issuesQuery(
  "{ project: { name: { in: $keys } } }",
);

const cachedIssuesByLabelKey = unstable_cache(
  async (labelKey: string) => {
    const labels = labelKey.split("|");
    return readIssues(ISSUES_BY_LABEL_QUERY, labels, labels);
  },
  ["linear-issues-by-label"],
  { revalidate: LINEAR_REVALIDATE_SECONDS },
);

const cachedIssuesByProjectKey = unstable_cache(
  async (projectKey: string) =>
    readIssues(ISSUES_BY_PROJECT_QUERY, projectKey.split("|"), null),
  ["linear-issues-by-project"],
  { revalidate: LINEAR_REVALIDATE_SECONDS },
);

const issuesByProjectKey = cache((projectKey: string) =>
  cachedIssuesByProjectKey(projectKey),
);

const issuesByLabelKey = cache((labelKey: string) =>
  cachedIssuesByLabelKey(labelKey),
);

export function fetchIssuesWithLabels(
  labels: string[],
): Promise<RoadmapTicket[]> {
  return issuesByLabelKey([...labels].sort().join("|"));
}

/**
 * Every issue sitting in the given projects, whatever its labels.
 *
 * What actually shipped in a release is the release project's contents —
 * not the roadmap-labelled subset. Shipped work loses its roadmap label,
 * so "3.35 Release" reads as empty by label and full by project.
 */
export function fetchIssuesInProjects(
  projects: string[],
): Promise<RoadmapTicket[]> {
  return issuesByProjectKey([...projects].sort().join("|"));
}

const PROJECTS_QUERY = /* GraphQL */ `
  query Projects($after: String) {
    projects(first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
      }
    }
  }
`;

interface ProjectsPage {
  data?: {
    projects: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: { name: string }[];
    };
  };
  errors?: { message: string }[];
}

/** Every Linear project name in the workspace (all pages). */
export async function fetchProjectNames(): Promise<string[]> {
  const apiKey = env.linearApiKey;
  if (!apiKey) throw new LinearError("LINEAR_API_KEY is not configured");

  const names: string[] = [];
  let after: string | null = null;

  for (;;) {
    const res = await fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: PROJECTS_QUERY, variables: { after } }),
      next: { revalidate: LINEAR_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      throw new LinearError(
        `Linear request failed: ${res.status} ${res.statusText}`,
      );
    }
    const page = (await res.json()) as ProjectsPage;
    if (page.errors?.length) {
      throw new LinearError(`Linear query failed: ${page.errors[0].message}`);
    }
    const projects = page.data?.projects;
    if (!projects) throw new LinearError("Linear returned no data");

    names.push(...projects.nodes.map((n) => n.name));
    if (!projects.pageInfo.hasNextPage) break;
    after = projects.pageInfo.endCursor;
  }

  return names;
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
