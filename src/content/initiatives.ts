/**
 * QA Roadmap content — the single file QA leads edit to keep the
 * roadmap current. Each initiative declares how its testing effort
 * is split between manual and automation (must sum to 100).
 *
 * Statuses mirror the Product Brain roadmap conventions.
 */

export type InitiativeStatus =
  | "investigation"
  | "planned"
  | "in-progress"
  | "delivered";

export type EffortArea =
  | "PMS"
  | "Client Handouts"
  | "Discharge Summary"
  | "Account Switching"
  | "Regression"
  | "Mobile"
  | "Platform";

export interface Initiative {
  id: string;
  title: string;
  description: string;
  area: EffortArea;
  status: InitiativeStatus;
  /** Percentage split of QA effort; manual + automation = 100. */
  effort: { manual: number; automation: number };
  /** Optional Testiny top-level folder ids backing this initiative. */
  testinyFolderIds?: number[];
  /** Free-form tags rendered as pills, e.g. release or squad names. */
  tags?: string[];
}

export const initiatives: Initiative[] = [
  {
    id: "regression-3-32",
    title: "Release Regression — 3.32",
    description:
      "Full regression pass for the 3.32 release across web and mobile. " +
      "Highest-volume recurring manual effort and the primary candidate " +
      "for progressive automation.",
    area: "Regression",
    status: "in-progress",
    effort: { manual: 90, automation: 10 },
    testinyFolderIds: [47],
    tags: ["3.32", "recurring"],
  },
  {
    id: "pms-integrations",
    title: "PMS Integrations (Covetrus, Packleader, Digimidi)",
    description:
      "Integration test coverage for practice-management-system connections: " +
      "sync correctness, conflict handling and connection recovery.",
    area: "PMS",
    status: "in-progress",
    effort: { manual: 100, automation: 0 },
    testinyFolderIds: [36],
    tags: ["integrations"],
  },
  {
    id: "client-handouts",
    title: "Client Handouts & Vetlexicon",
    description:
      "Manual coverage of handout creation, Vetlexicon content and delivery " +
      "to clients. Stable feature — candidate for smoke automation.",
    area: "Client Handouts",
    status: "delivered",
    effort: { manual: 100, automation: 0 },
    testinyFolderIds: [45],
    tags: ["stable"],
  },
  {
    id: "discharge-summary",
    title: "Visit / Discharge Summary",
    description:
      "End-to-end validation of visit and discharge summary generation, " +
      "including AI-generated content review.",
    area: "Discharge Summary",
    status: "delivered",
    effort: { manual: 100, automation: 0 },
    testinyFolderIds: [31],
    tags: ["P1"],
  },
  {
    id: "account-switching",
    title: "Account Switching & Access Control",
    description:
      "PIN-based switching, timeout lock screen and user-access permissions. " +
      "Security-sensitive area kept under manual exploratory coverage.",
    area: "Account Switching",
    status: "delivered",
    effort: { manual: 100, automation: 0 },
    testinyFolderIds: [41],
    tags: ["security"],
  },
  {
    id: "smoke-automation",
    title: "Automated Smoke Suite (Playwright)",
    description:
      "First automation milestone: a CI smoke suite covering login, case " +
      "creation, handout generation and PMS sync status. Unblocks faster " +
      "release sign-off and shrinks the manual regression burden.",
    area: "Platform",
    status: "planned",
    effort: { manual: 20, automation: 80 },
    tags: ["automation", "CI"],
  },
  {
    id: "regression-automation",
    title: "Regression Automation — Wave 1",
    description:
      "Convert the most repetitive, highest-value regression cases " +
      "(target: top 25% by execution count) into automated coverage.",
    area: "Regression",
    status: "investigation",
    effort: { manual: 40, automation: 60 },
    tags: ["automation"],
  },
  {
    id: "mobile-coverage",
    title: "Mobile Regression Coverage",
    description:
      "Dedicated mobile regression checklist split from the web suite, " +
      "with device-matrix prioritization.",
    area: "Mobile",
    status: "investigation",
    effort: { manual: 100, automation: 0 },
    tags: ["mobile"],
  },
];

export const statusMeta: Record<
  InitiativeStatus,
  { label: string; className: string }
> = {
  investigation: {
    label: "Investigation",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  planned: {
    label: "Planned",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  delivered: {
    label: "Delivered",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
};

/** Aggregate manual/automation split across non-delivered initiatives. */
export function overallEffortSplit(): { manual: number; automation: number } {
  const active = initiatives.filter((i) => i.status !== "delivered");
  if (active.length === 0) return { manual: 100, automation: 0 };
  const manual =
    active.reduce((sum, i) => sum + i.effort.manual, 0) / active.length;
  return { manual: Math.round(manual), automation: 100 - Math.round(manual) };
}
