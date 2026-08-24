import { RELEASE_NAME, versionRank } from "../release-utils";

/**
 * Descope rules, kept pure (no I/O, no server-only) so they can be
 * executed directly in a test. The fetching lives in descope.ts.
 *
 * A feature that sat in a release project and then left it is a descope:
 * in practice it failed a happy path, or an urgent bug made it
 * unshippable in the time left, so it was pushed out — usually into a
 * squad project like "Squad 4 - Cross-Product".
 *
 * Decided with QA:
 * - ANY move out of a release counts, including straight into another
 *   release. The release's scope shrank either way, and features quietly
 *   pushed to the next release are exactly what this should expose.
 * - Moving INTO a release is never a descope, so a feature that is
 *   descoped and later picked up again is not flagged for the pick-up
 *   (scenario 1).
 * - History is kept per release. A feature descoped from 3.35 and again
 *   from 3.36 appears under both (scenario 2); no "recovered" state is
 *   tracked, because 3.35 shipped without it either way.
 * - Within one release a feature appears ONCE even if it left that same
 *   release repeatedly — latest exit wins. That is what keeps the
 *   release filter free of duplicate rows (scenario 2, second half).
 */

/** One feature leaving one release. */
export interface DescopeEvent {
  /** Linear identifier, e.g. "COV-6244". */
  id: string;
  title: string;
  url: string;
  /** Release version left behind, e.g. "3.36". */
  fromRelease: string;
  /** Project it moved to — null when left with no project at all. */
  toProject: string | null;
  /** Set when it went straight into another release. */
  toRelease: string | null;
  /** ISO timestamp of the move. */
  at: string;
  priorityName: string | null;
  status: string;
  statusType: string;
}

/** The shape the Linear history query returns per issue. */
export interface DescopeHistoryIssue {
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  state: { name: string; type: string };
  history: {
    nodes: {
      createdAt: string;
      fromProject: { name: string } | null;
      toProject: { name: string } | null;
    }[];
  };
}

/** "3.36 Release" -> "3.36"; null for anything that is not a release. */
export function releaseVersionOf(
  project: string | null | undefined,
): string | null {
  if (!project || !RELEASE_NAME.test(project)) return null;
  return project.match(/(\d+\.\d+)/)?.[1] ?? null;
}

/** Turns raw issue history into one descope event per release per feature. */
export function detectDescopes(
  issues: DescopeHistoryIssue[],
): Record<string, DescopeEvent[]> {
  // Keyed "3.36|COV-1234" so a feature that left the same release more
  // than once collapses to its latest exit instead of duplicating.
  const latest = new Map<string, DescopeEvent>();

  for (const issue of issues) {
    for (const change of issue.history.nodes) {
      const fromRelease = releaseVersionOf(change.fromProject?.name);
      // Only leaving a release counts; joining one never does.
      if (!fromRelease) continue;
      const toName = change.toProject?.name ?? null;
      // A no-op move back into the same release is not a descope.
      if (toName && releaseVersionOf(toName) === fromRelease) continue;

      const key = `${fromRelease}|${issue.identifier}`;
      const previous = latest.get(key);
      if (previous && previous.at >= change.createdAt) continue;

      latest.set(key, {
        id: issue.identifier,
        title: issue.title,
        url: issue.url,
        fromRelease,
        toProject: toName,
        toRelease: releaseVersionOf(toName),
        at: change.createdAt,
        priorityName: issue.priority > 0 ? issue.priorityLabel : null,
        status: issue.state.name,
        statusType: issue.state.type,
      });
    }
  }

  const byRelease: Record<string, DescopeEvent[]> = {};
  for (const event of latest.values()) {
    (byRelease[event.fromRelease] ??= []).push(event);
  }
  // Most recent exit first within a release.
  for (const events of Object.values(byRelease)) {
    events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  }

  // Newest release first.
  return Object.fromEntries(
    Object.entries(byRelease).sort(
      ([a], [b]) => (versionRank(b) ?? 0) - (versionRank(a) ?? 0),
    ),
  );
}
