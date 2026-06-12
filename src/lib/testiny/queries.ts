import "server-only";

import { env } from "@/lib/env";
import {
  findAllEntities,
  testinyConfigured,
  TestinyError,
} from "@/lib/testiny/client";
import { sampleSnapshot } from "@/lib/testiny/sample-data";
import type {
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
  results: TestinyRunResultValues[],
): RunSummary {
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, notRun: 0 };
  for (const r of results) {
    switch (r.result_status?.toUpperCase()) {
      case "PASSED":
        counts.passed++;
        break;
      case "FAILED":
        counts.failed++;
        break;
      case "BLOCKED":
        counts.blocked++;
        break;
      case "SKIPPED":
        counts.skipped++;
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
  };
}

/**
 * One snapshot powering the Manual Testing and Releases pages.
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
    // closed). The mapping join flattens to one row per (run, case)
    // pair, so fetch all rows and aggregate per run.
    const recentRuns = [...runs]
      .sort((a, b) => Number(a.is_closed) - Number(b.is_closed) || b.id - a.id)
      .slice(0, 8);

    const joinRows = await findAllEntities<TestinyTestRun>("testrun", {
      ids: recentRuns.map((r) => r.id),
      map: { entities: ["testcase", "testrun"] },
    });

    const resultsByRun = new Map<number, TestinyRunResultValues[]>();
    for (const row of joinRows) {
      const bucket = resultsByRun.get(row.id) ?? [];
      bucket.push(...asArray(row.testrun_testcase_values));
      resultsByRun.set(row.id, bucket);
    }

    const runSummaries = recentRuns.map((run) =>
      summarizeRun(run, resultsByRun.get(run.id) ?? []),
    );

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
