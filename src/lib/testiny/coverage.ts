import "server-only";

import { env } from "@/lib/env";
import { findAllEntities, testinyConfigured, TestinyError } from "@/lib/testiny/client";
import type { TestinyFolder, TestinyTestCase } from "@/lib/testiny/types";

export interface FolderCoverage {
  folderId: number;
  folderTitle: string;
  /** Test cases in the folder and all of its descendants. */
  caseCount: number;
}

/**
 * Index of Linear ticket ids (uppercase, e.g. "COV-99") to the Testiny
 * folders whose titles mention them. A ticket "has test cases" when at
 * least one mentioning folder contains cases in its subtree — QA's
 * convention is one folder per ticket, named after it (e.g. "Cov-2230").
 */
export type CoverageIndex = Map<string, FolderCoverage[]>;

const TICKET_PATTERN = /\bCOV[-\s]?(\d+)\b/gi;

/** Extract normalized ticket ids ("COV-123") mentioned in a string. */
export function ticketIdsIn(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(TICKET_PATTERN)) {
    ids.add(`COV-${match[1]}`);
  }
  return [...ids];
}

export async function getCoverageIndex(): Promise<CoverageIndex> {
  const index: CoverageIndex = new Map();
  if (!testinyConfigured()) return index;

  try {
    const projectId = env.testinyProjectId;
    // Same queries (and cache entries) as the manual-testing snapshot.
    const [folders, cases] = await Promise.all([
      findAllEntities<TestinyFolder>("testcase-folder", {
        filter: { project_id: projectId },
      }),
      findAllEntities<TestinyTestCase>("testcase", {
        filter: { project_id: projectId },
        map: { entities: ["testcase", "testcase_folder"], idOnly: true },
      }),
    ]);

    // Direct case count per folder.
    const directCounts = new Map<number, number>();
    for (const tc of cases) {
      const values = tc.testcase_folder_testcase_values;
      const folderId = (Array.isArray(values) ? values[0] : values)
        ?.testcase_folder_id;
      if (folderId) {
        directCounts.set(folderId, (directCounts.get(folderId) ?? 0) + 1);
      }
    }

    // Subtree counts via children traversal.
    const children = new Map<number, number[]>();
    for (const f of folders) {
      const parent = f.testcase_folder_parent_id;
      if (parent) {
        children.set(parent, [...(children.get(parent) ?? []), f.id]);
      }
    }
    const subtreeCount = (id: number, seen = new Set<number>()): number => {
      if (seen.has(id)) return 0; // defensive: cycle guard
      seen.add(id);
      let total = directCounts.get(id) ?? 0;
      for (const child of children.get(id) ?? []) {
        total += subtreeCount(child, seen);
      }
      return total;
    };

    for (const folder of folders) {
      const ticketIds = ticketIdsIn(folder.title);
      if (ticketIds.length === 0) continue;
      const coverage: FolderCoverage = {
        folderId: folder.id,
        folderTitle: folder.title,
        caseCount: subtreeCount(folder.id),
      };
      for (const ticketId of ticketIds) {
        index.set(ticketId, [...(index.get(ticketId) ?? []), coverage]);
      }
    }

    return index;
  } catch (error) {
    if (error instanceof TestinyError) {
      console.warn(`Coverage index unavailable: ${error.message}`);
      return index;
    }
    throw error;
  }
}
