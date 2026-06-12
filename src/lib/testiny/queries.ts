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
  TestinyRunResult,
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

function summarizeRun(run: TestinyTestRun, results: TestinyRunResult[]): RunSummary {
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
      findAllEntities<TestinyFolder>("testcase-folder", { project_id: projectId }),
      findAllEntities<TestinyTestCase>("testcase", { project_id: projectId }),
      findAllEntities<TestinyTestRun>("testrun", { project_id: projectId }),
    ]);

    const project = projects.find((p) => p.id === projectId);

    // Count test cases per top-level folder (folders form a tree via parent_id).
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const rootOf = (folderId: number): TestinyFolder | undefined => {
      let current = folderById.get(folderId);
      const seen = new Set<number>();
      while (current?.parent_id && folderById.has(current.parent_id)) {
        if (seen.has(current.id)) break; // defensive: cycle guard
        seen.add(current.id);
        current = folderById.get(current.parent_id);
      }
      return current;
    };

    const casesByRootFolder = new Map<number, number>();
    const casesByType: Record<string, number> = {};
    const casesByPriority: Record<string, number> = {};
    for (const tc of cases) {
      if (tc.folder_id) {
        const root = rootOf(tc.folder_id);
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

    // Summarize the most recent runs (open runs first, then latest closed).
    const recentRuns = [...runs]
      .sort((a, b) => Number(a.is_closed) - Number(b.is_closed) || b.id - a.id)
      .slice(0, 8);

    const runSummaries = await Promise.all(
      recentRuns.map(async (run) => {
        const results = await findAllEntities<TestinyRunResult>(
          "testcase-testrun",
          { testrun_id: run.id },
        );
        return summarizeRun(run, results);
      }),
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
