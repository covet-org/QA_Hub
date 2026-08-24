/** Linear-backed QA roadmap shapes. */

/**
 * The parent issue (user story / epic) of a sub-issue, as Linear reports
 * it. Carried on the child because a parent is often not itself labeled
 * for the roadmap, so it never appears in the queried result set.
 */
export interface ParentRef {
  /** Linear identifier, e.g. "COV-6244". */
  id: string;
  title: string;
  url: string;
  status: string;
  statusType: string;
  project: string | null;
  /** Linear priority label when triaged (e.g. "Urgent"), else null. */
  priorityName: string | null;
}

export interface RoadmapTicket {
  /** Linear identifier, e.g. "COV-5299". */
  id: string;
  title: string;
  url: string;
  /** ISO timestamp the ticket was filed — drives the bug trend chart. */
  createdAt?: string;
  /** Workflow state name, e.g. "Ready for QA". */
  status: string;
  /** Workflow state category: backlog | unstarted | started | completed | canceled. */
  statusType: string;
  /** The queried labels present on this ticket. */
  labels: string[];
  /** Linear project name, e.g. "3.32 Release". */
  project: string | null;
  /** Linear priority label when triaged (e.g. "Urgent"), else null. */
  priorityName?: string | null;
  /** Who the ticket is assigned to in Linear, null when unassigned. */
  assigneeName?: string | null;
  /** Identifier of the parent issue (e.g. a user story), if any. */
  parentId?: string | null;
  /** The parent issue's own fields, when the ticket is a sub-issue. */
  parent?: ParentRef | null;
  /** Every label on the ticket (used for exclusion rules). */
  allLabels?: string[];
}

/** A ticket joined with its Testiny coverage. */
export interface CoveredTicket extends RoadmapTicket {
  hasTestCases: boolean;
  /** Test cases found in Testiny folders mentioning this ticket id. */
  caseCount: number;
  /** Titles of the matching Testiny folders. */
  folders: string[];
}

/**
 * One row of the roadmap board: a ticket, plus its sub-issues nested
 * underneath when it has any within the same release group.
 */
export interface RoadmapNode {
  ticket: CoveredTicket;
  /**
   * True when this row exists only to hold its sub-issues: the parent
   * issue itself carries no roadmap label, so it is NOT counted in the
   * coverage stats (which stay "roadmap-labeled tickets only").
   */
  contextOnly: boolean;
  /** Sub-issues of this ticket that belong to the same release group. */
  children: CoveredTicket[];
}

export interface ReleaseGroup {
  /** Display name, e.g. "3.32 Release" or "Other projects". */
  name: string;
  /** True for "X.YZ Release" projects (sorted newest first). */
  isRelease: boolean;
  /** Flat list of the roadmap-labeled tickets in this group (drives counts). */
  tickets: CoveredTicket[];
  /** The same tickets as a parent/sub-issue tree (drives the board). */
  nodes: RoadmapNode[];
}

export interface RoadmapSnapshot {
  /** True when Linear data comes from the bundled fixture. */
  isSample: boolean;
  groups: ReleaseGroup[];
  totalTickets: number;
  coveredTickets: number;
}
