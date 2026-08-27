import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { env } from "@/lib/env";
import {
  LINEAR_REVALIDATE_SECONDS,
  LinearError,
  fetchProjects,
} from "@/lib/linear/client";
import { RELEASE_NAME } from "@/lib/release-utils";

/** A version that reached production, and when. */
export interface ProductionRelease {
  /** "3.36" — major.minor, matching how releases are named everywhere else. */
  release: string;
  /** Reached the pipeline's released stage. */
  liveAt: string;
  /**
   * Entered the pipeline — the build moving to staging, which is where
   * regression runs. A Friday for 3.36, three days before release.
   */
  stagingAt: string | null;
}

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

/** "3.36.0" and "3.36" both name release 3.36. */
const RELEASE_VERSION = /(\d+\.\d+)/;

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
/**
 * Scoped to pipelines, not to releases.
 *
 * Asking `releases(first: 50)` looked equivalent and was not: releases
 * come back newest-first across *every* pipeline, and the Dev pipeline
 * creates one per push ("Dev 3.37.0 (#2157)"). Fifty of those buried
 * every production release except the newest, so the chart showed one
 * window where there were four. Walking the pipelines instead bounds the
 * result by construction.
 */
const RELEASES_QUERY = /* GraphQL */ `
  query ProductionReleases {
    releasePipelines(first: 20) {
      nodes {
        isProduction
        releases(first: 30) {
          nodes {
            version
            startedAt
            completedAt
            stage {
              type
            }
          }
        }
      }
    }
  }
`;

interface ReleaseNode {
  version: string | null;
  startedAt: string | null;
  completedAt: string | null;
  stage: { type: string } | null;
}

interface ReleasesResponse {
  data?: {
    releasePipelines?: {
      nodes: {
        isProduction: boolean;
        releases: { nodes: ReleaseNode[] } | null;
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

  const pipelines = page.data?.releasePipelines?.nodes;
  if (!pipelines) return null;

  const out: ProductionRelease[] = [];
  for (const pipeline of pipelines) {
    if (!pipeline.isProduction) continue;
    for (const node of pipeline.releases?.nodes ?? []) {
      // Released, not merely started: a release sitting in staging is not
      // in front of customers yet.
      if (node.stage?.type !== "completed") continue;
      const liveAt = node.completedAt;
      if (!liveAt || !node.version) continue;
      const release = node.version.match(RELEASE_VERSION)?.[1];
      if (!release) continue;
      out.push({ release, liveAt, stagingAt: node.startedAt ?? null });
    }
  }

  // Newest first, and one entry per release: a version re-released keeps
  // its first arrival in production.
  const earliest = new Map<string, ProductionRelease>();
  for (const entry of out) {
    const known = earliest.get(entry.release);
    if (!known || Date.parse(entry.liveAt) < Date.parse(known.liveAt)) {
      earliest.set(entry.release, entry);
    }
  }

  return [...earliest.values()].sort(
    (a, b) => Date.parse(b.liveAt) - Date.parse(a.liveAt),
  );
}

const cachedProductionReleases = unstable_cache(
  readProductionReleases,
  ["linear-production-releases"],
  { revalidate: LINEAR_REVALIDATE_SECONDS },
);

export const fetchProductionReleases = cache(cachedProductionReleases);

/**
 * Release version -> when its "N Release" project was created in Linear.
 *
 * That creation is the start of sandbox testing — a Thursday, by process —
 * and it is the only durable record of it. Testiny cannot supply this: a
 * run's first `result_at` is when someone first saved a result, which is
 * later than the phase began and moves forward whenever a case is
 * re-executed.
 *
 * Returns an empty map rather than throwing, so a Linear outage costs the
 * sandbox-start row and nothing else on the page.
 */
async function readReleaseProjectDates(): Promise<Record<string, string>> {
  if (!env.linearApiKey) return {};
  try {
    const projects = await fetchProjects();
    const out: Record<string, string> = {};
    for (const project of projects) {
      // Strictly "N.N Release" — a project merely mentioning a version
      // ("3.37 hotfixes") is not the release project the process creates.
      if (!RELEASE_NAME.test(project.name)) continue;
      const version = project.name.match(RELEASE_VERSION)?.[1];
      if (!version) continue;
      // A version with two projects keeps the earlier creation: the
      // process starts once, whatever tidying happened afterwards.
      const known = out[version];
      if (!known || Date.parse(project.createdAt) < Date.parse(known)) {
        out[version] = project.createdAt;
      }
    }
    return out;
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    console.warn(`Release project dates unavailable: ${error.message}`);
    return {};
  }
}

const cachedReleaseProjectDates = unstable_cache(
  readReleaseProjectDates,
  ["linear-release-project-dates"],
  { revalidate: LINEAR_REVALIDATE_SECONDS },
);

export const fetchReleaseProjectDates = cache(cachedReleaseProjectDates);
