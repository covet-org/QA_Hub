import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { env } from "@/lib/env";
import { LINEAR_REVALIDATE_SECONDS, LinearError } from "@/lib/linear/client";

export interface InitiativeStats {
  /** Initiatives currently being worked on. */
  active: number;
  /** Every initiative, whatever its status. */
  total: number;
}

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

/**
 * Initiative counts from Linear.
 *
 * Replaces a hand-maintained list that had gone stale without anyone
 * noticing: it still called the 3.32 regression "in progress" seven weeks
 * and four releases after 3.32 shipped. A dashboard number nobody can
 * verify is worse than no number, so this one comes from the same place
 * as everything else on the page.
 *
 * Returns null rather than throwing if the field is unavailable, so the
 * caller can say where its number came from instead of quietly inventing
 * one.
 */
const INITIATIVES_QUERY = /* GraphQL */ `
  query Initiatives {
    initiatives(first: 100) {
      nodes {
        status
      }
    }
  }
`;

interface InitiativesResponse {
  data?: {
    initiatives?: { nodes: { status: string | null }[] } | null;
  };
  errors?: { message: string }[];
}

/**
 * Linear's initiative statuses are Planned, Active and Completed.
 * "Active" is the one that means someone is working on it now.
 */
const ACTIVE_STATUS = /^active$/i;

async function readInitiativeStats(): Promise<InitiativeStats | null> {
  const apiKey = env.linearApiKey;
  if (!apiKey) throw new LinearError("LINEAR_API_KEY is not configured");

  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query: INITIATIVES_QUERY }),
  });

  if (!res.ok) {
    console.warn(`Linear initiatives unavailable (${res.status}).`);
    return null;
  }

  const page = (await res.json()) as InitiativesResponse;
  if (page.errors?.length) {
    console.warn(`Linear initiatives query rejected: ${page.errors[0].message}`);
    return null;
  }

  const nodes = page.data?.initiatives?.nodes;
  if (!nodes) return null;

  return {
    active: nodes.filter((n) => n.status && ACTIVE_STATUS.test(n.status)).length,
    total: nodes.length,
  };
}

const cachedInitiativeStats = unstable_cache(
  readInitiativeStats,
  ["linear-initiatives"],
  { revalidate: LINEAR_REVALIDATE_SECONDS },
);

export const fetchInitiativeStats = cache(cachedInitiativeStats);
