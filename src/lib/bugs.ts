import "server-only";

import { env } from "@/lib/env";
import {
  fetchIssuesWithLabels,
  fetchProjectNames,
  linearConfigured,
  LinearError,
} from "@/lib/linear/client";
import type { RoadmapTicket } from "@/lib/linear/types";
import { buildBugTrends, type ReleaseTrend } from "@/lib/bug-trend";
import {
  buildCsBugTrends,
  buildReleaseWindows,
} from "@/lib/cs-bug-trend";
import { RELEASE_NAME, releaseRank } from "@/lib/release-utils";
import { fetchProductionReleases } from "@/lib/linear/releases";
import { RELEASE_GO_LIVE } from "@/content/release-go-live";
import { getActiveReleaseFloor } from "@/lib/testiny/queries";

export type BugKind = "product" | "cs";

export interface BugGroup {
  /** Display name, e.g. "3.32 Release" or "No release". */
  name: string;
  isRelease: boolean;
  /**
   * Release groups: true while the release still has (or is ahead of)
   * an open Testiny run. Non-release groups always count as active.
   */
  isActiveRelease: boolean;
  openCount: number;
  tickets: RoadmapTicket[];
}

export interface BugsSnapshot {
  /** True when Linear is not configured (nothing to show). */
  isSample: boolean;
  groups: BugGroup[];
  totalBugs: number;
  openBugs: number;
}

const OPEN_STATUS_TYPES = new Set(["backlog", "unstarted", "started"]);

function isOpen(ticket: RoadmapTicket): boolean {
  return OPEN_STATUS_TYPES.has(ticket.statusType);
}

/**
 * Bugs from Linear ("Bug" or "CS Bug" label) grouped by release
 * project. Whether a release counts as active is derived from
 * Testiny: releases at or above the oldest open test run are active.
 */
export async function getBugsSnapshot(kind: BugKind): Promise<BugsSnapshot> {
  if (!linearConfigured()) {
    return { isSample: true, groups: [], totalBugs: 0, openBugs: 0 };
  }

  const label = kind === "cs" ? env.csBugLabel : env.bugLabel;
  let tickets: RoadmapTicket[];
  let projectNames: string[];
  try {
    [tickets, projectNames] = await Promise.all([
      fetchIssuesWithLabels([label]),
      fetchProjectNames(),
    ]);
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    console.warn(`Bugs unavailable: ${error.message}`);
    return { isSample: true, groups: [], totalBugs: 0, openBugs: 0 };
  }

  const activeFloor = await getActiveReleaseFloor();

  // Only bugs in release projects, Cross-Product, or with no release
  // belong on the board — other backlog projects are out of QA scope.
  const inScope = (project: string | null): boolean =>
    project === null ||
    RELEASE_NAME.test(project) ||
    /cross-?product/i.test(project);

  const scoped = tickets.filter((t) => inScope(t.project));

  // Seed every numbered release project so the timeline is complete
  // even for releases with zero bugs under this label.
  const byProject = new Map<string, RoadmapTicket[]>();
  for (const name of projectNames) {
    if (RELEASE_NAME.test(name)) byProject.set(name, []);
  }
  for (const ticket of scoped) {
    const key = ticket.project ?? "No release";
    byProject.set(key, [...(byProject.get(key) ?? []), ticket]);
  }

  const groups: BugGroup[] = [...byProject.entries()]
    .map(([name, list]) => {
      const isRelease = RELEASE_NAME.test(name);
      const sorted = list.sort(
        (a, b) =>
          Number(isOpen(b)) - Number(isOpen(a)) ||
          b.id.localeCompare(a.id, undefined, { numeric: true }),
      );
      return {
        name,
        isRelease,
        isActiveRelease: !isRelease || releaseRank(name) >= activeFloor,
        openCount: list.filter(isOpen).length,
        tickets: sorted,
      };
    })
    .sort((a, b) => releaseRank(b.name) - releaseRank(a.name));

  return {
    isSample: false,
    groups,
    totalBugs: scoped.length,
    openBugs: scoped.filter(isOpen).length,
  };
}

/**
 * Bug discovery curves for the Home chart.
 *
 * Reuses the product-bug snapshot, so this costs nothing beyond what the
 * Bugs page already fetches (both share the 5-minute Linear cache).
 * Returns an empty list rather than throwing: a chart is not worth
 * failing the landing page over.
 */
export async function getBugTrends(): Promise<ReleaseTrend[]> {
  try {
    const snapshot = await getBugsSnapshot("product");
    return buildBugTrends(snapshot.groups.flatMap((g) => g.tickets));
  } catch (error) {
    console.error(
      `Bug trends unavailable: ${error instanceof Error ? error.message : error}`,
    );
    return [];
  }
}

/**
 * CS bugs per release, attributed by date rather than by project.
 *
 * A CS bug is filed cross-product, so the only thing tying it to a
 * release is when it arrived: a release owns production from its own
 * go-live until the next release's. Go-live comes from Linear's
 * production release pipeline, falling back to the checked-in table when
 * that API surface is unavailable — see content/release-go-live.ts.
 *
 * The CS tickets are the same ones the CS bug board fetches, so they cost
 * nothing beyond it.
 */
export interface CsBugTrends {
  trends: ReleaseTrend[];
  /** Which go-live source produced these windows, for the card to name. */
  source: "pipeline" | "table" | "none";
}

export async function getCsBugTrends(): Promise<CsBugTrends> {
  try {
    const [snapshot, pipeline] = await Promise.all([
      getBugsSnapshot("cs"),
      // Never let the newer release API take the card down with it.
      fetchProductionReleases().catch(() => null),
    ]);

    const goLive =
      pipeline && pipeline.length > 0
        ? pipeline
        : Object.entries(RELEASE_GO_LIVE).map(([release, liveAt]) => ({
            release,
            liveAt,
          }));
    const source: CsBugTrends["source"] =
      pipeline && pipeline.length > 0 ? "pipeline" : "table";

    const windows = buildReleaseWindows(goLive, Date.now());
    return {
      trends: buildCsBugTrends(
        snapshot.groups.flatMap((g) => g.tickets),
        windows,
      ),
      source,
    };
  } catch (error) {
    console.error(
      `CS bug trends unavailable: ${error instanceof Error ? error.message : error}`,
    );
    return { trends: [], source: "none" };
  }
}
