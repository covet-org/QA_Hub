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
  groupCsBugsByWindow,
  type ReleaseWindow,
} from "@/lib/cs-bug-trend";
import { byPriority } from "@/lib/priority";
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

/** Still needs work: not done, not cancelled. */
export function isOpenStatus(statusType: string): boolean {
  return OPEN_STATUS_TYPES.has(statusType);
}

function isOpen(ticket: RoadmapTicket): boolean {
  return isOpenStatus(ticket.statusType);
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
      // Open first, and urgent first within the open ones. A closed
      // Urgent bug is history; an open one is work, and no amount of
      // priority makes a finished ticket the thing to look at first.
      const sorted = list.sort(
        (a, b) =>
          Number(isOpen(b)) - Number(isOpen(a)) ||
          byPriority(a, b) ||
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
 * Takes the label's tickets directly rather than the CS board's snapshot.
 * The board scopes itself to release projects, Cross-Product and
 * unassigned, which is right for a QA board and wrong here: customer
 * bugs are triaged into projects like "Bugs" and "Recording Issues", and
 * that filter dropped nine of 3.35's eleven. The label is the whole
 * definition of a CS bug; where it was triaged afterwards is not.
 *
 * Same cached fetch the board uses, so it costs nothing beyond it.
 */
export interface CsBugTrends {
  trends: ReleaseTrend[];
  /** Which go-live source produced these windows, for the card to name. */
  source: "pipeline" | "table" | "none";
}

export async function getCsBugTrends(): Promise<CsBugTrends> {
  try {
    const [tickets, pipeline] = await Promise.all([
      fetchIssuesWithLabels([env.csBugLabel]),
      // Never let the newer release API take the card down with it.
      fetchProductionReleases().catch(() => null),
    ]);

    const goLive =
      pipeline && pipeline.length > 0
        ? pipeline
        : Object.entries(RELEASE_GO_LIVE).map(([release, liveAt]) => ({
            release,
            liveAt,
            stagingAt: null,
          }));
    const source: CsBugTrends["source"] =
      pipeline && pipeline.length > 0 ? "pipeline" : "table";

    const windows = buildReleaseWindows(goLive, Date.now());
    return {
      trends: buildCsBugTrends(tickets, windows),
      source,
    };
  } catch (error) {
    console.error(
      `CS bug trends unavailable: ${error instanceof Error ? error.message : error}`,
    );
    return { trends: [], source: "none" };
  }
}

/**
 * Once every bug that can be attributed sits under its release, a
 * "cross product" bucket stops meaning anything: what was left in it was
 * not a kind of bug, only the stretch of history before the release
 * pipeline starts. The board covers the releases it can speak about and
 * says so; the count of what falls outside lives in `outsideWindows`.
 */

/**
 * The CS board, grouped the way the Home chart counts.
 *
 * Not getBugsSnapshot: that groups by Linear project and scopes itself to
 * release projects, Cross-Product and unassigned, which on this label
 * showed 15 of 60-odd bugs under seventeen empty release headings. A
 * customer bug's project says where it was triaged; only its date says
 * which release was in front of customers when it arrived.
 *
 * Bugs older than the earliest go-live are grouped under Cross Product
 * rather than dropped — they are real, we just cannot attribute them.
 */
export async function getCsBugBoard(): Promise<{
  groups: BugGroup[];
  source: "pipeline" | "table" | "none";
  isSample: boolean;
  /** The oldest release the board can attribute anything to. */
  oldestRelease: string | null;
  /** CS bugs filed before that release shipped, so not shown here. */
  outsideWindows: number;
}> {
  if (!linearConfigured()) {
    return {
      groups: [],
      source: "none",
      isSample: true,
      oldestRelease: null,
      outsideWindows: 0,
    };
  }

  let tickets: RoadmapTicket[];
  let windows: ReleaseWindow[];
  let source: "pipeline" | "table" | "none";
  try {
    const [all, pipeline] = await Promise.all([
      fetchIssuesWithLabels([env.csBugLabel]),
      fetchProductionReleases().catch(() => null),
    ]);
    tickets = all;
    const goLive =
      pipeline && pipeline.length > 0
        ? pipeline
        : Object.entries(RELEASE_GO_LIVE).map(([release, liveAt]) => ({
            release,
            liveAt,
          }));
    source = pipeline && pipeline.length > 0 ? "pipeline" : "table";
    windows = buildReleaseWindows(goLive, Date.now());
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    console.warn(`CS bugs unavailable: ${error.message}`);
    return {
      groups: [],
      source: "none",
      isSample: true,
      oldestRelease: null,
      outsideWindows: 0,
    };
  }

  const grouped = groupCsBugsByWindow(tickets, windows);
  // Windows come back newest-first, so the last one is the oldest release
  // we can attribute anything to.
  const oldest = windows.length > 0 ? windows[windows.length - 1].release : null;
  const outsideWindows =
    grouped.find((entry) => entry.release === null)?.tickets.length ?? 0;

  const groups: BugGroup[] = grouped
    // Attributable bugs only. What is left over is not a category, just
    // the history before the release pipeline begins — reported as a
    // number in the header rather than as a 550-row group nobody opens.
    .filter((entry) => entry.release !== null)
    .map((entry) => {
    const sorted = [...entry.tickets].sort(
      (a, b) =>
        Number(isOpen(b)) - Number(isOpen(a)) ||
        byPriority(a, b) ||
        b.id.localeCompare(a.id, undefined, { numeric: true }),
    );
    return {
      name: `${entry.release} Release`,
      isRelease: entry.release !== null,
      // Every window is worth reading on this board; "active" is a
      // testing-phase idea and these releases are already in production.
      isActiveRelease: true,
      openCount: sorted.filter(isOpen).length,
      tickets: sorted,
    };
  });

  return { groups, source, isSample: false, oldestRelease: oldest, outsideWindows };
}
