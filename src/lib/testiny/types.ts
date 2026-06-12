/**
 * Subset of Testiny REST API entities used by this app.
 * Field names verified against the live API (api/v1/swagger.json).
 */

export interface TestinyProject {
  id: number;
  project_key: string;
  name: string;
}

export interface TestinyFolder {
  id: number;
  title: string;
  /** 0 for root folders. */
  testcase_folder_parent_id: number | null;
  project_id: number;
}

/** Mapping row linking a test case to its folder. */
export interface TestinyCaseFolderValues {
  testcase_id: number;
  testcase_folder_id: number;
}

export interface TestinyTestCase {
  id: number;
  title: string;
  project_id: number;
  priority?: number | null; // 0 Critical … 3 Low
  testcase_type?: string | null; // FUNCTIONAL, REGRESSION, …
  /** Present when queried with map {entities:["testcase","testcase_folder"]}. */
  testcase_folder_testcase_values?: TestinyCaseFolderValues | TestinyCaseFolderValues[];
}

/** Mapping row carrying the execution result of a case within a run. */
export interface TestinyRunResultValues {
  testcase_id: number;
  testrun_id: number;
  result_status: string | null; // PASSED | FAILED | BLOCKED | SKIPPED | NOTRUN
  /** Set when the case was removed from the run (don't count those). */
  deleted_at?: string | null;
}

export interface TestinyTestRun {
  id: number;
  title: string;
  project_id: number;
  is_closed: boolean;
  created_at?: string;
  /** Present when queried with map {entities:["testcase","testrun"]}. */
  testrun_testcase_values?: TestinyRunResultValues | TestinyRunResultValues[];
}

export interface TestinyFindResponse<T> {
  meta: { count?: number; offset?: number; limit?: number };
  data: T[];
}

/** Aggregated, UI-friendly shapes. */

/** A test case referenced from a run's problem list. */
export interface CaseRef {
  id: number;
  title: string;
  /** Deep link to the case inside the Testiny run. */
  url: string;
}

export interface RunSummary {
  id: number;
  title: string;
  isClosed: boolean;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  /** The actual cases behind the failed/blocked/skipped counts. */
  failedCases?: CaseRef[];
  blockedCases?: CaseRef[];
  skippedCases?: CaseRef[];
}

export interface ManualTestingSnapshot {
  /** True when rendered from bundled sample data (no TESTINY_API_KEY). */
  isSample: boolean;
  projectName: string;
  totalTestCases: number;
  casesByType: Record<string, number>;
  casesByPriority: Record<string, number>;
  topFolders: { id: number; title: string; caseCount: number }[];
  runs: RunSummary[];
}
