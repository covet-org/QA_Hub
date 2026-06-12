import "server-only";

import { fetchRoadmapIssues, linearConfigured, LinearError } from "@/lib/linear/client";
import { sampleTickets } from "@/lib/linear/sample-data";
import type {
  CoveredTicket,
  ReleaseGroup,
  RoadmapSnapshot,
  RoadmapTicket,
} from "@/lib/linear/types";
import { getCoverageIndex } from "@/lib/testiny/coverage";

const RELEASE_NAME = /^(\d+)\.(\d+)\s+Release$/i;

/** Sort key: release projects newest-first, then other projects, then none. */
function releaseRank(name: string | null): number {
  if (!name) return -1;
  const match = name.match(RELEASE_NAME);
  if (!match) return 0;
  return Number(match[1]) * 1000 + Number(match[2]);
}

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

  const covered: CoveredTicket[] = tickets.map((ticket) => {
    const folders = coverage.get(ticket.id.toUpperCase()) ?? [];
    const caseCount = folders.reduce((sum, f) => sum + f.caseCount, 0);
    return {
      ...ticket,
      hasTestCases: caseCount > 0,
      caseCount,
      folders: folders.map((f) => f.folderTitle),
    };
  });

  // Group by project; release projects first, newest release on top.
  const byProject = new Map<string, CoveredTicket[]>();
  for (const ticket of covered) {
    const key = ticket.project ?? "No project";
    byProject.set(key, [...(byProject.get(key) ?? []), ticket]);
  }

  const groups: ReleaseGroup[] = [...byProject.entries()]
    .map(([name, list]) => ({
      name,
      isRelease: RELEASE_NAME.test(name),
      tickets: list.sort((a, b) =>
        Number(a.hasTestCases) - Number(b.hasTestCases) || a.id.localeCompare(b.id),
      ),
    }))
    .sort((a, b) => releaseRank(b.name) - releaseRank(a.name));

  return {
    isSample,
    groups,
    totalTickets: covered.length,
    coveredTickets: covered.filter((t) => t.hasTestCases).length,
  };
}
