import "server-only";

import { fetchRoadmapIssues, linearConfigured, LinearError } from "@/lib/linear/client";
import { sampleTickets } from "@/lib/linear/sample-data";
import type {
  CoveredTicket,
  ParentRef,
  ReleaseGroup,
  RoadmapSnapshot,
  RoadmapTicket,
} from "@/lib/linear/types";
import { RELEASE_NAME, releaseRank } from "@/lib/release-utils";
import { buildRoadmapNodes } from "@/lib/roadmap-tree";
import { byPriority } from "@/lib/priority";
import { getCoverageIndex } from "@/lib/testiny/coverage";

/**
 * The QA roadmap: Linear tickets carrying the roadmap labels, grouped
 * by release project and joined with Testiny test-case coverage.
 */
export async function getRoadmapSnapshot(): Promise<RoadmapSnapshot> {
  let tickets: RoadmapTicket[];
  let isSample = false;

  if (linearConfigured()) {
    try {
      tickets = await fetchRoadmapIssues();
    } catch (error) {
      if (!(error instanceof LinearError)) throw error;
      console.warn(`Falling back to Linear fixture: ${error.message}`);
      tickets = sampleTickets;
      isSample = true;
    }
  } else {
    tickets = sampleTickets;
    isSample = true;
  }

  const coverage = await getCoverageIndex();

  const coverageOf = (id: string) => {
    const folders = coverage.get(id.toUpperCase()) ?? [];
    const caseCount = folders.reduce((sum, f) => sum + f.caseCount, 0);
    return {
      hasTestCases: caseCount > 0,
      caseCount,
      folders: folders.map((f) => f.folderTitle),
    };
  };

  const covered: CoveredTicket[] = tickets.map((ticket) => ({
    ...ticket,
    ...coverageOf(ticket.id),
  }));

  // A parent issue without a roadmap label still needs a row to hold its
  // sub-issues. It gets the same coverage lookup, but the board marks it
  // context-only so it stays out of the counts above.
  const contextTicket = (parent: ParentRef): CoveredTicket => ({
    ...parent,
    labels: [],
    ...coverageOf(parent.id),
  });

  // Group by project; release projects first, newest release on top.
  const byProject = new Map<string, CoveredTicket[]>();
  for (const ticket of covered) {
    const key = ticket.project ?? "No project";
    byProject.set(key, [...(byProject.get(key) ?? []), ticket]);
  }

  const groups: ReleaseGroup[] = [...byProject.entries()]
    .map(([name, list]) => {
      /**
       * Uncovered first, urgent first within them — the roadmap's version
       * of the bug boards' "open first, priority within". What the board
       * is for is finding tickets that still need test cases, and Product
       * Pile has 57 tickets with 6 covered: priority alone buried the
       * gaps under work that is already done.
       */
      const tickets = list.sort(
        (a, b) =>
          Number(a.hasTestCases) - Number(b.hasTestCases) ||
          byPriority(a, b) ||
          a.id.localeCompare(b.id),
      );
      return {
        name,
        isRelease: RELEASE_NAME.test(name),
        tickets,
        nodes: buildRoadmapNodes(tickets, contextTicket),
      };
    })
    .sort((a, b) => releaseRank(b.name) - releaseRank(a.name));

  return {
    isSample,
    groups,
    totalTickets: covered.length,
    coveredTickets: covered.filter((t) => t.hasTestCases).length,
  };
}
