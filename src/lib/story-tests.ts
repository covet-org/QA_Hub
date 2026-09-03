/**
 * Per-story test execution, taken from a release's Dev/Sandbox run.
 *
 * The join is folder-based, because that is how QA links the two systems:
 * a Testiny folder is named after the ticket it covers ("Cov-2230"), so a
 * case belongs to the ticket named by the nearest ancestor folder that
 * mentions one. The same convention already decides "has test cases" on
 * the roadmap — this reuses it rather than inventing a second rule that
 * could disagree.
 *
 * Nearest ancestor, not any ancestor: a folder tree of
 *   "3.37" → "COV-8144 Download PDFs" → "Edge cases"
 * puts the edge cases on COV-8144, and a case sitting directly under
 * "3.37" belongs to no ticket at all rather than to all of them.
 *
 * Pure: no I/O, so the join is testable without keys.
 */

/** What a story's cases did in the run, shaped for RunProgressBar. */
export interface StoryTestProgress {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  /** The run these counts came from, for the row's tooltip. */
  runTitle: string;
}

interface FolderLike {
  id: number;
  title: string;
  testcase_folder_parent_id?: number | null;
}

interface CaseLike {
  id: number;
  folderId: number | null;
}

interface ResultLike {
  testcase_id: number;
  result_status?: string | null;
}

const TICKET_PATTERN = /\bCOV[-\s]?(\d+)\b/gi;

/** Normalised ticket ids ("COV-123") mentioned in a folder title. */
function ticketIdsIn(title: string): string[] {
  const ids = new Set<string>();
  for (const match of title.matchAll(TICKET_PATTERN)) {
    ids.add(`COV-${match[1]}`);
  }
  return [...ids];
}

/**
 * Case id -> the tickets it covers.
 *
 * A folder title may name more than one ticket, in which case its cases
 * count for each: two stories sharing a suite both did the testing.
 */
export function mapCasesToTickets(
  folders: FolderLike[],
  cases: CaseLike[],
): Map<number, string[]> {
  const byId = new Map<number, FolderLike>(folders.map((f) => [f.id, f]));

  // Memoised walk up the tree, so a deep folder is resolved once even when
  // it holds a hundred cases.
  const ticketsOfFolder = new Map<number, string[]>();
  const resolve = (folderId: number): string[] => {
    const cached = ticketsOfFolder.get(folderId);
    if (cached) return cached;

    const chain: number[] = [];
    let current: number | null = folderId;
    let found: string[] = [];
    const seen = new Set<number>();

    while (current !== null && !seen.has(current)) {
      seen.add(current);
      const memo = ticketsOfFolder.get(current);
      if (memo) {
        found = memo;
        break;
      }
      const folder = byId.get(current);
      if (!folder) break;
      chain.push(current);
      const ids = ticketIdsIn(folder.title);
      if (ids.length > 0) {
        found = ids;
        break;
      }
      current = folder.testcase_folder_parent_id ?? null;
    }

    // Every folder on the way up shares the answer: they are all inside
    // the same ticket's subtree (or all outside every ticket).
    for (const id of chain) ticketsOfFolder.set(id, found);
    return found;
  };

  const out = new Map<number, string[]>();
  for (const tc of cases) {
    if (tc.folderId === null) continue;
    const tickets = resolve(tc.folderId);
    if (tickets.length > 0) out.set(tc.id, tickets);
  }
  return out;
}

function emptyProgress(runTitle: string): StoryTestProgress {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    notRun: 0,
    runTitle,
  };
}

/**
 * Ticket id -> its execution in this run.
 *
 * Only cases that are actually IN the run count. A story with fifty cases
 * in Testiny and three in the sandbox run reads 3 total, because the bar
 * answers "how far is this story's sandbox testing", not "how big is its
 * suite" — the roadmap already answers the second.
 */
export function buildStoryTestProgress({
  results,
  caseToTickets,
  runTitle,
}: {
  results: ResultLike[];
  caseToTickets: Map<number, string[]>;
  runTitle: string;
}): Record<string, StoryTestProgress> {
  const out: Record<string, StoryTestProgress> = {};

  for (const row of results) {
    const tickets = caseToTickets.get(row.testcase_id);
    if (!tickets) continue;

    const status = row.result_status?.toUpperCase();
    for (const ticket of tickets) {
      const progress = (out[ticket] ??= emptyProgress(runTitle));
      progress.total++;
      switch (status) {
        case "PASSED":
          progress.passed++;
          break;
        case "FAILED":
          progress.failed++;
          break;
        case "BLOCKED":
          progress.blocked++;
          break;
        case "SKIPPED":
          progress.skipped++;
          break;
        default:
          progress.notRun++;
      }
    }
  }

  return out;
}

/** Executed share, 0–100, for the row's label. Blocked and skipped count
 *  as executed: somebody made a call on them, which is what a completion
 *  bar is reporting. */
export function executedPercent(p: StoryTestProgress): number {
  if (p.total === 0) return 0;
  return Math.round(((p.total - p.notRun) / p.total) * 100);
}
