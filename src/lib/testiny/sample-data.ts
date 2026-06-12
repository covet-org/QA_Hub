import type { ManualTestingSnapshot } from "@/lib/testiny/types";

/**
 * Bundled snapshot shown when TESTINY_API_KEY is not configured,
 * so the app is fully demoable out of the box. Shapes mirror the
 * real "QA CoVet" Testiny project.
 */
export const sampleSnapshot: ManualTestingSnapshot = {
  isSample: true,
  projectName: "QA CoVet (sample data)",
  totalTestCases: 412,
  casesByType: {
    Functional: 198,
    Regression: 124,
    Sanity: 38,
    Acceptance: 27,
    Usability: 15,
    Security: 10,
  },
  casesByPriority: {
    Critical: 52,
    High: 131,
    Medium: 168,
    Low: 61,
  },
  topFolders: [
    { id: 36, title: "PMS", caseCount: 96 },
    { id: 45, title: "Client Handouts", caseCount: 64 },
    { id: 31, title: "Discharge Summary", caseCount: 58 },
    { id: 41, title: "Account Switching", caseCount: 41 },
    { id: 47, title: "Regression Suite", caseCount: 120 },
  ],
  runs: [
    {
      id: 29,
      title: "Feature testing 3.32",
      isClosed: false,
      total: 84,
      passed: 51,
      failed: 6,
      blocked: 3,
      skipped: 2,
      notRun: 22,
    },
    {
      id: 28,
      title: "Regression 3.31",
      isClosed: false,
      total: 120,
      passed: 97,
      failed: 4,
      blocked: 2,
      skipped: 5,
      notRun: 12,
    },
    {
      id: 26,
      title: "Regression 3.30",
      isClosed: false,
      total: 118,
      passed: 110,
      failed: 3,
      blocked: 1,
      skipped: 4,
      notRun: 0,
    },
    {
      id: 27,
      title: "Feature testing 3.31",
      isClosed: true,
      total: 73,
      passed: 66,
      failed: 5,
      blocked: 0,
      skipped: 2,
      notRun: 0,
    },
  ],
};
