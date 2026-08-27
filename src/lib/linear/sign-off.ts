import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { env } from "@/lib/env";
import { LINEAR_REVALIDATE_SECONDS, LinearError } from "@/lib/linear/client";
import {
  buildSignOffBoard,
  type SignOffHistoryIssue,
  type SignOffStory,
} from "@/lib/sign-off";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

/**
 * Cross-Product stories with the two things the design gate needs: their
 * status history, and their attachments.
 *
 * Attachments are where the Slack half lives — Linear's Slack integration
 * stores a shared thread as an attachment whose URL carries the channel id.
 * Verified against COV-7719, which holds both a GitHub PR attachment and a
 * Slack one.
 *
 * Scoped to one project and two labels, so this is ~20 issues rather than
 * the whole workspace, and cached like every other Linear read.
 */
const SIGN_OFF_QUERY = /* GraphQL */ `
  query SignOffStories($project: String!, $labels: [String!]!, $after: String) {
    issues(
      first: 100
      after: $after
      filter: {
        project: { name: { eq: $project } }
        labels: { name: { in: $labels } }
      }
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
        history(first: 100) {
          nodes {
            createdAt
            toState {
              name
            }
          }
        }
        attachments {
          nodes {
            title
            subtitle
            url
            createdAt
          }
        }
      }
    }
  }
`;

interface SignOffPage {
  data?: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: SignOffHistoryIssue[];
    };
  };
  errors?: { message: string }[];
}

export interface SignOffSnapshot {
  rows: SignOffStory[];
  /** True when Linear is not configured, so nothing could be read. */
  isSample: boolean;
  /** Set when Linear was configured but the query failed. */
  error: string | null;
}

async function readSignOff(): Promise<SignOffSnapshot> {
  const apiKey = env.linearApiKey;
  if (!apiKey) return { rows: [], isSample: true, error: null };

  const issues: SignOffHistoryIssue[] = [];
  let after: string | null = null;

  try {
    for (;;) {
      const res = await fetch(LINEAR_GRAPHQL_URL, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: SIGN_OFF_QUERY,
          variables: {
            project: env.signOffProject,
            labels: env.signOffLabels,
            after,
          },
        }),
      });
      if (!res.ok) {
        throw new LinearError(
          `Linear sign-off query failed: ${res.status} ${res.statusText}`,
        );
      }
      const page = (await res.json()) as SignOffPage;
      if (page.errors?.length) {
        throw new LinearError(
          `Linear sign-off failed: ${page.errors[0].message}`,
        );
      }
      const data = page.data?.issues;
      if (!data) throw new LinearError("Linear returned no data");

      issues.push(...data.nodes);
      if (!data.pageInfo.hasNextPage) break;
      after = data.pageInfo.endCursor;
    }
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    // Say so rather than render an empty board that looks like "nothing to
    // sign off" — a missing gate reads as a passed gate otherwise.
    console.warn(`Sign-off board unavailable: ${error.message}`);
    return { rows: [], isSample: false, error: error.message };
  }

  return {
    rows: buildSignOffBoard({
      issues,
      channelId: env.signOffSlackChannelId,
      channelName: env.signOffSlackChannelName,
      mergedStatus: env.signOffMergedStatus,
      syncSince: env.signOffSyncSince,
      confirmPhrases: env.signOffConfirmPhrases,
    }),
    isSample: false,
    error: null,
  };
}

const cachedSignOff = unstable_cache(readSignOff, ["linear-sign-off"], {
  revalidate: LINEAR_REVALIDATE_SECONDS,
});

export const getSignOffSnapshot = cache(cachedSignOff);
