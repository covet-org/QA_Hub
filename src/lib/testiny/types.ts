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
  /** Set when the case was deleted from the library (Testiny hides these). */
  deleted_at?: string | null;
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
  /**
   * When this case was executed. The only trustworthy timing signal on a
   * run: `closed_at` is bookkeeping — 3.36's dev and regression runs share
   * the close stamp 2026-08-24T19:09Z, three days after the last case was
   * actually run, and 3.34 Dev and 3.35 Dev share another.
   */
  result_at?: string | null;
  /** Set when the case was removed from the run (don't count those). */
  deleted_at?: string | null;
  /** Who the case is assigned to WITHIN this run, so the same case can
   *  have different owners in different runs. */
  assigned_user_id?: number | null;
  /** "USER" when assigned to a person; null when unassigned. */
  assigned_to?: string | null;
  /**
   * Display name, resolved by Testiny itself. Verified against the live
   * API: the run/testcase mapping returns this computed field, so no
   * separate user lookup is needed. ($-prefixed = computed server-side.)
   */
  $assignee_name?: string | null;
}

export interface TestinyTestRun {
  id: number;
  title: string;
  project_id: number;
  is_closed: boolean;
  created_at?: string;
  closed_at?: string | null;
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
  /** Assignee within the run, null when unassigned or unresolvable. */
  assignee?: string | null;
}

export interface RunSummary {
  id: number;
  title: string;
  isClosed: boolean;
  /** First and last execution in this run — when work really happened. */
  firstResultAt?: string | null;
  lastResultAt?: string | null;
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
