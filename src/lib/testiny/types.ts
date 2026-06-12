/** Subset of Testiny REST API entities used by this app. */

export interface TestinyProject {
  id: number;
  project_key: string;
  name: string;
}

export interface TestinyFolder {
  id: number;
  title: string;
  parent_id: number | null;
  project_id: number;
}

export interface TestinyTestCase {
  id: number;
  title: string;
  folder_id: number | null;
  project_id: number;
  priority?: number | null; // 0 Critical … 3 Low
  testcase_type?: string | null; // FUNCTIONAL, REGRESSION, …
}

export interface TestinyTestRun {
  id: number;
  title: string;
  project_id: number;
  is_closed: boolean;
  created_at?: string;
}

/** testcase↔testrun mapping row; carries the execution result. */
export interface TestinyRunResult {
  testcase_id: number;
  testrun_id: number;
  result_status: string; // PASSED | FAILED | BLOCKED | SKIPPED | NOTRUN …
}

export interface TestinyFindResponse<T> {
  meta: { count?: number };
  data: T[];
}

/** Aggregated, UI-friendly shapes. */
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
