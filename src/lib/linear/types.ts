/** Linear-backed QA roadmap shapes. */

export interface RoadmapTicket {
  /** Linear identifier, e.g. "COV-5299". */
  id: string;
  title: string;
  url: string;
  /** Workflow state name, e.g. "Ready for QA". */
  status: string;
  /** Workflow state category: backlog | unstarted | started | completed | canceled. */
  statusType: string;
  /** The roadmap labels on this ticket (subset of QA_ROADMAP_LABELS). */
  labels: string[];
  /** Linear project name, e.g. "3.32 Release". */
  project: string | null;
}

/** A ticket joined with its Testiny coverage. */
export interface CoveredTicket extends RoadmapTicket {
  hasTestCases: boolean;
  /** Test cases found in Testiny folders mentioning this ticket id. */
  caseCount: number;
  /** Titles of the matching Testiny folders. */
  folders: string[];
}

export interface ReleaseGroup {
  /** Display name, e.g. "3.32 Release" or "Other projects". */
  name: string;
  /** True for "X.YZ Release" projects (sorted newest first). */
  isRelease: boolean;
  tickets: CoveredTicket[];
}

export interface RoadmapSnapshot {
  /** True when Linear data comes from the bundled fixture. */
  isSample: boolean;
  groups: ReleaseGroup[];
  totalTickets: number;
  coveredTickets: number;
}
