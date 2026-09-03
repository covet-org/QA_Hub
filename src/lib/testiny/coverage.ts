import "server-only";

import { cache } from "react";

import { env } from "@/lib/env";
import {
  findAllEntitiesCached,
  testinyConfigured,
  TestinyError,
} from "@/lib/testiny/client";
import { mapCasesToTickets } from "@/lib/story-tests";
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

/**
 * Wrapped below so the roadmap and the Home feature breakdown share one
 * build per render. A Map cannot go through unstable_cache (it is not
 * JSON), so only the per-request layer applies to the Map itself — but the
 * folder and case reads underneath now go through findAllEntitiesCached,
 * which is what stops every navigation re-pulling every test case in the
 * project. Rebuilding the Map from cached rows is free by comparison.
 */
async function readCoverageIndex(): Promise<CoverageIndex> {
  const index: CoverageIndex = new Map();
  if (!testinyConfigured()) return index;

  try {
    const projectId = env.testinyProjectId;
    // Same queries (and cache entries) as the manual-testing snapshot.
    const [folders, cases] = await Promise.all([
      findAllEntitiesCached<TestinyFolder>("testcase-folder", {
        filter: { project_id: projectId },
      }),
      findAllEntitiesCached<TestinyTestCase>("testcase", {
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

export const getCoverageIndex = cache(readCoverageIndex);

/**
 * Test case id -> the tickets it covers, by the nearest ancestor folder
 * that names one.
 *
 * Same two reads as the coverage index above, so on a page that builds
 * both this costs nothing extra: findAllEntitiesCached hands back the
 * same rows.
 */
async function readCaseTicketIndex(): Promise<Map<number, string[]>> {
  if (!testinyConfigured()) return new Map();

  try {
    const projectId = env.testinyProjectId;
    const [folders, cases] = await Promise.all([
      findAllEntitiesCached<TestinyFolder>("testcase-folder", {
        filter: { project_id: projectId },
      }),
      findAllEntitiesCached<TestinyTestCase>("testcase", {
        filter: { project_id: projectId },
        map: { entities: ["testcase", "testcase_folder"], idOnly: true },
      }),
    ]);

    return mapCasesToTickets(
      folders,
      cases.map((tc) => {
        const values = tc.testcase_folder_testcase_values;
        const folder = Array.isArray(values) ? values[0] : values;
        return { id: tc.id, folderId: folder?.testcase_folder_id ?? null };
      }),
    );
  } catch (error) {
    if (error instanceof TestinyError) {
      console.warn(`Case-ticket index unavailable: ${error.message}`);
      return new Map();
    }
    throw error;
  }
}

export const getCaseTicketIndex = cache(readCaseTicketIndex);
