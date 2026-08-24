import "server-only";

import { env } from "@/lib/env";
import { versionRank } from "@/lib/release-utils";
import {
  findAllEntities,
  testinyConfigured,
  TestinyError,
} from "@/lib/testiny/client";
import { sampleSnapshot } from "@/lib/testiny/sample-data";
import type {
  CaseRef,
  ManualTestingSnapshot,
  RunSummary,
  TestinyFolder,
  TestinyProject,
  TestinyRunResultValues,
  TestinyTestCase,
  TestinyTestRun,
} from "@/lib/testiny/types";

const PRIORITY_LABELS: Record<number, string> = {
  0: "Critical",
  1: "High",
  2: "Medium",
  3: "Low",
};

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** Testiny returns a single object instead of an array for 1-row mappings. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function summarizeRun(
  run: TestinyTestRun,
  allResults: TestinyRunResultValues[],
  caseTitles: Map<number, string>,
  projectKey: string,
): RunSummary {
  // Rows with deleted_at were removed from the run — don't count them.
  const results = allResults.filter((r) => !r.deleted_at);
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, notRun: 0 };
  const failedCases: CaseRef[] = [];
  const blockedCases: CaseRef[] = [];
  const skippedCases: CaseRef[] = [];

  const caseRef = (r: TestinyRunResultValues): CaseRef => ({
    id: r.testcase_id,
    title: caseTitles.get(r.testcase_id) ?? `TC-${r.testcase_id}`,
    url: `https://app.testiny.io/${projectKey}/testruns/tr/${run.id}/tc/${r.testcase_id}`,
    // Testiny resolves the name for us on the mapping row; the id is the
    // fallback so an assigned case never reads as unassigned.
    assignee:
      r.$assignee_name ??
      (r.assigned_user_id ? `User ${r.assigned_user_id}` : null),
  });

  for (const r of results) {
    switch (r.result_status?.toUpperCase()) {
      case "PASSED":
        counts.passed++;
        break;
      case "FAILED":
        counts.failed++;
        failedCases.push(caseRef(r));
        break;
      case "BLOCKED":
        counts.blocked++;
        blockedCases.push(caseRef(r));
        break;
      case "SKIPPED":
        counts.skipped++;
        skippedCases.push(caseRef(r));
        break;
      default:
        counts.notRun++;
    }
  }
  return {
    id: run.id,
    title: run.title,
    isClosed: run.is_closed,
    total: results.length,
    ...counts,
    failedCases,
    blockedCases,
    skippedCases,
  };
}

/** Key of the Testiny project, used to build deep links into runs. */
async function getProjectKey(): Promise<string> {
  const projects = await findAllEntities<TestinyProject>("project");
  return (
    projects.find((p) => p.id === env.testinyProjectId)?.project_key ?? "P"
  );
}

/** Expand results for the given runs and summarize each. */
async function summarizeRunsWithResults(
  runs: TestinyTestRun[],
): Promise<RunSummary[]> {
  if (runs.length === 0) return [];

  // includeDeleted keeps mapping rows the join would otherwise drop; we
  // then drop cases deleted from the library (see deletedCaseIds below)
  // so the counts match Testiny's own run summary, which hides them.
  const joinRows = await findAllEntities<TestinyTestRun>("testrun", {
    ids: runs.map((r) => r.id),
    map: { entities: ["testcase", "testrun"], includeDeleted: true },
  });

  const resultsByRun = new Map<number, TestinyRunResultValues[]>();
  const caseIds = new Set<number>();
  for (const row of joinRows) {
    const bucket = resultsByRun.get(row.id) ?? [];
    for (const value of asArray(row.testrun_testcase_values)) {
      bucket.push(value);
      caseIds.add(value.testcase_id);
    }
    resultsByRun.set(row.id, bucket);
  }

  // Fetch the referenced cases (incl. deleted) for their titles and to
  // identify cases deleted from the library — Testiny excludes those from
  // a run's totals even though their results linger in the mapping.
  const caseTitles = new Map<number, string>();
  const deletedCaseIds = new Set<number>();
  if (caseIds.size > 0) {
    const cases = await findAllEntities<TestinyTestCase>("testcase", {
      ids: [...caseIds],
      includeDeleted: true,
    });
    for (const tc of cases) {
      caseTitles.set(tc.id, tc.title);
      if (tc.deleted_at) deletedCaseIds.add(tc.id);
    }
  }

  const projectKey = await getProjectKey();
  return runs.map((run) => {
    const rows = (resultsByRun.get(run.id) ?? []).filter(
      (r) => !deletedCaseIds.has(r.testcase_id),
    );
    return summarizeRun(run, rows, caseTitles, projectKey);
  });
}

/**
 * The version rank (major*1000+minor) of the oldest release that still
 * has an open Testiny run — releases at or above it count as "active".
 * Returns Infinity when no runs are open (everything counts as closed).
 */
export async function getActiveReleaseFloor(): Promise<number> {
  let titles: string[];
  if (!testinyConfigured()) {
    titles = sampleSnapshot.runs.filter((r) => !r.isClosed).map((r) => r.title);
  } else {
    try {
      const runs = await findAllEntities<TestinyTestRun>("testrun", {
        filter: { project_id: env.testinyProjectId },
      });
      titles = runs.filter((r) => !r.is_closed).map((r) => r.title);
    } catch (error) {
      if (!(error instanceof TestinyError)) throw error;
      console.warn(`Active-release floor unavailable: ${error.message}`);
      titles = [];
    }
  }

  const ranks = titles
    .map(versionRank)
    .filter((r): r is number => r !== null);
  return ranks.length > 0 ? Math.min(...ranks) : Infinity;
}

export interface ReleasePhase {
  /** Calendar days from the first run opening to the last run closing. */
  days: number;
  /** True while any run of this phase is still open. */
  inProgress: boolean;
}

export interface ReleaseDuration {
  release: string; // "3.32"
  rank: number;
  feature?: ReleasePhase;
  regression?: ReleasePhase;
}

const sampleDurations: ReleaseDuration[] = [
  { release: "3.32", rank: 3032, feature: { days: 9.4, inProgress: true } },
  {
    release: "3.31",
    rank: 3031,
    feature: { days: 11.2, inProgress: false },
    regression: { days: 12.5, inProgress: true },
  },
  {
    release: "3.30",
    rank: 3030,
    feature: { days: 6.8, inProgress: false },
    regression: { days: 15.1, inProgress: false },
  },
];

/**
 * How long each release's testing phases took, from Testiny run
 * timestamps: feature runs dictate feature testing, regression runs
 * dictate the regression pass required to ship. A phase spans from its
 * first run opening to its last run closing (or now, while open).
 */
export async function getReleaseDurations(): Promise<{
  isSample: boolean;
  releases: ReleaseDuration[];
}> {
  if (!testinyConfigured()) {
    return { isSample: true, releases: sampleDurations };
  }

  try {
    const runs = await findAllEntities<TestinyTestRun>("testrun", {
      filter: { project_id: env.testinyProjectId },
    });

    // phase key: `${rank}:${phase}` → time window
    const windows = new Map<
      string,
      { release: string; rank: number; phase: "feature" | "regression"; start: number; end: number; inProgress: boolean }
    >();

    const now = Date.now();
    for (const run of runs) {
      const rank = versionRank(run.title);
      if (rank === null || !run.created_at) continue;
      // "Regression", and the occasional "Regresion" typo.
      const phase = /regres+ion/i.test(run.title) ? "regression" : "feature";
      const release = run.title.match(/(\d+\.\d+)/)?.[1] ?? run.title;

      const start = Date.parse(run.created_at);
      const inProgress = !run.is_closed;
      const end = run.closed_at && run.is_closed ? Date.parse(run.closed_at) : now;

      const key = `${rank}:${phase}`;
      const window = windows.get(key);
      if (!window) {
        windows.set(key, { release, rank, phase, start, end, inProgress });
      } else {
        window.start = Math.min(window.start, start);
        window.end = Math.max(window.end, end);
        window.inProgress = window.inProgress || inProgress;
      }
    }

    const byRelease = new Map<number, ReleaseDuration>();
    for (const w of windows.values()) {
      const entry = byRelease.get(w.rank) ?? { release: w.release, rank: w.rank };
      entry[w.phase] = {
        days: Math.round(((w.end - w.start) / 86_400_000) * 10) / 10,
        inProgress: w.inProgress,
      };
      byRelease.set(w.rank, entry);
    }

    const releases = [...byRelease.values()]
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 8);

    return { isSample: false, releases };
  } catch (error) {
    if (error instanceof TestinyError) {
      console.warn(`Release durations unavailable: ${error.message}`);
      return { isSample: true, releases: sampleDurations };
    }
    throw error;
  }
}

export interface RunsByState {
  isSample: boolean;
  runs: RunSummary[];
}

/** All runs in the given state, newest first (closed capped at 15). */
export async function getRunSummariesByState(
  state: "active" | "closed",
): Promise<RunsByState> {
  const wantClosed = state === "closed";

  if (!testinyConfigured()) {
    return {
      isSample: true,
      runs: sampleSnapshot.runs.filter((r) => r.isClosed === wantClosed),
    };
  }

  try {
    const runs = await findAllEntities<TestinyTestRun>("testrun", {
      filter: { project_id: env.testinyProjectId },
    });
    const selected = runs
      .filter((r) => r.is_closed === wantClosed)
      .sort((a, b) => b.id - a.id)
      .slice(0, wantClosed ? 15 : undefined);

    return { isSample: false, runs: await summarizeRunsWithResults(selected) };
  } catch (error) {
    if (error instanceof TestinyError) {
      console.warn(`Falling back to sample runs: ${error.message}`);
      return {
        isSample: true,
        runs: sampleSnapshot.runs.filter((r) => r.isClosed === wantClosed),
      };
    }
    throw error;
  }
}

/**
 * One snapshot powering the Home and Manual Testing pages.
 * Falls back to bundled sample data when no API key is configured,
 * and degrades gracefully (sample + console warning) on API errors
 * so a Testiny outage never takes the page down.
 */
export async function getManualTestingSnapshot(): Promise<ManualTestingSnapshot> {
  if (!testinyConfigured()) {
    return sampleSnapshot;
  }

  try {
    const projectId = env.testinyProjectId;

    const [projects, folders, cases, runs] = await Promise.all([
      findAllEntities<TestinyProject>("project"),
      findAllEntities<TestinyFolder>("testcase-folder", {
        filter: { project_id: projectId },
      }),
      // Folder membership is a mapping table; expand it per case.
      findAllEntities<TestinyTestCase>("testcase", {
        filter: { project_id: projectId },
        map: { entities: ["testcase", "testcase_folder"], idOnly: true },
      }),
      findAllEntities<TestinyTestRun>("testrun", {
        filter: { project_id: projectId },
      }),
    ]);

    const project = projects.find((p) => p.id === projectId);

    // Count test cases per top-level folder (folders form a tree).
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const rootOf = (folderId: number): TestinyFolder | undefined => {
      let current = folderById.get(folderId);
      const seen = new Set<number>();
      while (
        current?.testcase_folder_parent_id &&
        folderById.has(current.testcase_folder_parent_id)
      ) {
        if (seen.has(current.id)) break; // defensive: cycle guard
        seen.add(current.id);
        current = folderById.get(current.testcase_folder_parent_id);
      }
      return current;
    };

    const casesByRootFolder = new Map<number, number>();
    const casesByType: Record<string, number> = {};
    const casesByPriority: Record<string, number> = {};
    for (const tc of cases) {
      const folderId = asArray(tc.testcase_folder_testcase_values)[0]
        ?.testcase_folder_id;
      if (folderId) {
        const root = rootOf(folderId);
        if (root) {
          casesByRootFolder.set(root.id, (casesByRootFolder.get(root.id) ?? 0) + 1);
        }
      }
      if (tc.testcase_type) {
        const label = titleCase(tc.testcase_type);
        casesByType[label] = (casesByType[label] ?? 0) + 1;
      }
      if (tc.priority !== null && tc.priority !== undefined) {
        const label = PRIORITY_LABELS[tc.priority] ?? `P${tc.priority}`;
        casesByPriority[label] = (casesByPriority[label] ?? 0) + 1;
      }
    }

    const topFolders = [...casesByRootFolder.entries()]
      .map(([id, caseCount]) => ({
        id,
        title: folderById.get(id)?.title ?? `Folder ${id}`,
        caseCount,
      }))
      .sort((a, b) => b.caseCount - a.caseCount)
      .slice(0, 8);

    // Summarize the most recent runs (open runs first, then latest
    // closed) for the Home/Manual stat cards.
    const recentRuns = [...runs]
      .sort((a, b) => Number(a.is_closed) - Number(b.is_closed) || b.id - a.id)
      .slice(0, 8);

    const runSummaries = await summarizeRunsWithResults(recentRuns);

    return {
      isSample: false,
      projectName: project?.name ?? "Testiny",
      totalTestCases: cases.length,
      casesByType,
      casesByPriority,
      topFolders,
      runs: runSummaries,
    };
  } catch (error) {
    if (error instanceof TestinyError) {
      console.warn(`Falling back to sample data: ${error.message}`);
      return { ...sampleSnapshot, projectName: "Testiny unavailable (sample data)" };
    }
    throw error;
  }
}
