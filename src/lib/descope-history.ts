import type { DescopeEvent } from "@/lib/linear/descope-rules";
import { versionRank } from "@/lib/release-utils";

/**
 * A feature's descope history as it is shown against the feature: when it
 * was pushed out of an earlier release, and the bugs it already had at
 * that moment.
 *
 * "At that moment" is meant literally and is only as strong as the data
 * allows: a bug counts when it was filed against this feature *before* the
 * move. Whether it was still open then is not claimed — that would need
 * each bug's state history, which is not fetched — so each bug carries its
 * status as it stands now and the copy says "filed by then".
 *
 * Pure, generic over the bug shape, so both the Home features card and the
 * Releases panels build it the same way and cannot disagree.
 */
export interface FeatureDescope<TBug> {
  /** Release the feature was pushed out of, e.g. "3.35". */
  fromRelease: string;
  /** Project it landed in — null when it left with no project at all. */
  toProject: string | null;
  /** Set when it went straight into another release. */
  toRelease: string | null;
  /** ISO timestamp of the move. */
  at: string;
  /** Bugs already filed against this feature when it was descoped. */
  bugsAtTheTime: TBug[];
}

interface BugLike {
  parentId: string | null;
  createdAt?: string | null;
}

/**
 * The descopes worth showing against one story in one release.
 *
 * Only exits from *earlier* releases: a feature listed under 3.37 is
 * explained by having been pushed out of 3.35, not by a later move. An
 * exit from the release being displayed is dropped too — a row saying
 * "3.36 was descoped from 3.36" reads as a bug in the dashboard even when
 * the underlying move is real.
 *
 * Pass a null version to keep every exit, which is what the roadmap wants:
 * a ticket parked in a squad project is not "under" any release.
 */
export function descopesForStory<TBug extends BugLike>(
  storyId: string,
  /**
   * The release this story is being read under, so only earlier exits
   * show. Null on the roadmap, where a ticket sits in a squad project and
   * has no release to be earlier than.
   */
  version: string | null,
  events: DescopeEvent[] | undefined,
  bugs: TBug[],
): FeatureDescope<TBug>[] {
  if (!events || events.length === 0) return [];
  const here = version === null ? null : (versionRank(version) ?? 0);

  const mine = bugs.filter((b) => b.parentId === storyId);

  return (
    events
      .filter((e) => here === null || (versionRank(e.fromRelease) ?? 0) < here)
      // Most recent exit first: it is the one that explains where the feature
      // is now, and it is what the row's tag names. Sorted here rather than
      // trusted from the caller so the order is a property of this function.
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => ({
        fromRelease: e.fromRelease,
        toProject: e.toProject,
        toRelease: e.toRelease,
        at: e.at,
        bugsAtTheTime: mine.filter(
          (b) => b.createdAt != null && b.createdAt <= e.at,
        ),
      }))
  );
}
