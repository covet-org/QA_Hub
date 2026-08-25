import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { env } from "@/lib/env";
import { LINEAR_REVALIDATE_SECONDS, LinearError } from "@/lib/linear/client";

/** A version that reached production, and when. */
export interface ProductionRelease {
  /** "3.36" — major.minor, matching how releases are named everywhere else. */
  release: string;
  /** Reached the pipeline's released stage. */
  liveAt: string;
}

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

/**
 * Releases in the production pipeline, newest first.
 *
 * This is the only place that knows when a release went live, which is
 * what CS bugs are attributed by. Linear's release pipelines are a newer
 * API surface than the issues and projects we query elsewhere, so this
 * may return null on a workspace or API version that does not expose
 * them — the caller falls back to the checked-in table. It returns null
 * rather than throwing or guessing: a wrong go-live date silently
 * reassigns a week of customer bugs to the wrong release.
 */
const RELEASES_QUERY = /* GraphQL */ `
  query ProductionReleases {
    releases(first: 50) {
      nodes {
        version
        startedAt
        completedAt
        stage {
          type
        }
        pipeline {
          isProduction
        }
      }
    }
  }
`;

interface ReleasesResponse {
  data?: {
    releases?: {
      nodes: {
        version: string | null;
        startedAt: string | null;
        completedAt: string | null;
        stage: { type: string } | null;
        pipeline: { isProduction: boolean } | null;
      }[];
    } | null;
  };
  errors?: { message: string }[];
}

async function readProductionReleases(): Promise<ProductionRelease[] | null> {
  const apiKey = env.linearApiKey;
  if (!apiKey) throw new LinearError("LINEAR_API_KEY is not configured");

  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ query: RELEASES_QUERY }),
  });

  if (!res.ok) {
    console.warn(
      `Linear releases unavailable (${res.status}); using the checked-in go-live table.`,
    );
    return null;
  }

  const page = (await res.json()) as ReleasesResponse;
  if (page.errors?.length) {
    // The likely case: this API does not expose release pipelines. Say so
    // once, plainly, so the fallback is a known state and not a mystery.
    console.warn(
      `Linear releases query rejected (${page.errors[0].message}); using the checked-in go-live table.`,
    );
    return null;
  }

  const nodes = page.data?.releases?.nodes;
  if (!nodes) return null;

  const out: ProductionRelease[] = [];
  for (const node of nodes) {
    if (!node.pipeline?.isProduction) continue;
    // Released, not merely started: a release sitting in staging is not
    // in front of customers yet.
    if (node.stage?.type !== "completed") continue;
    const liveAt = node.completedAt;
    if (!liveAt || !node.version) continue;
    const release = node.version.match(/(\d+\.\d+)/)?.[1];
    if (!release) continue;
    out.push({ release, liveAt });
  }

  // Newest first, and one entry per release: a version re-released keeps
  // its first arrival in production.
  const earliest = new Map<string, string>();
  for (const entry of out) {
    const known = earliest.get(entry.release);
    if (!known || Date.parse(entry.liveAt) < Date.parse(known)) {
      earliest.set(entry.release, entry.liveAt);
    }
  }

  return [...earliest.entries()]
    .map(([release, liveAt]) => ({ release, liveAt }))
    .sort((a, b) => Date.parse(b.liveAt) - Date.parse(a.liveAt));
}

const cachedProductionReleases = unstable_cache(
  readProductionReleases,
  ["linear-production-releases"],
  { revalidate: LINEAR_REVALIDATE_SECONDS },
);

export const fetchProductionReleases = cache(cachedProductionReleases);
