import "server-only";

import {
  fetchArchivedReleaseProjectMoves,
  fetchReleaseProjectMoves,
  type ReleaseProjectMoves,
} from "@/lib/linear/releases";
import { isRegressionRun, releaseOfRun } from "@/lib/release-progression";
import {
  buildReleaseTimeline,
  type ReleaseTimeline,
} from "@/lib/release-timeline";
import { versionRank } from "@/lib/release-utils";
import {
  getCounterpartRunSummaries,
  getRegressionCloseByRelease,
  getRunSummariesForReleases,
} from "@/lib/testiny/queries";
import type { RunSummary } from "@/lib/testiny/types";

export interface ReleaseBoardData {
  runs: RunSummary[];
  /** Keyed by release, e.g. "3.36". */
  timelines: Record<string, ReleaseTimeline>;
  isSample: boolean;
}

/**
 * Everything the Releases board needs, for a named set of releases.
 *
 * Scoped rather than "everything on this board" because the cost is per
 * release: each one drags in its runs' case results and its project's
 * issue history. The Closed board opens on the newest release alone and
 * loads the rest when a viewer asks for them, and both paths come through
 * here so a release loaded later is built exactly like one loaded first.
 */
export async function getReleaseBoardData(
  state: "active" | "closed",
  releases: string[],
): Promise<ReleaseBoardData> {
  if (releases.length === 0) {
    return { runs: [], timelines: {}, isSample: false };
  }

  const { isSample, runs } = await getRunSummariesForReleases(state, releases);
  const projectNames = releases.map((r) => `${r} Release`);

  const [counterparts, moves, regressionCloses] = await Promise.all([
    getCounterpartRunSummaries(releases, state),
    // Closed releases have shipped and their history cannot change, so it
    // is read from the day-long archive rather than the live cache.
    (state === "active"
      ? fetchReleaseProjectMoves
      : fetchArchivedReleaseProjectMoves)(projectNames).catch(
      (): ReleaseProjectMoves => ({ arrivals: {}, descopesByFeature: {} }),
    ),
    getRegressionCloseByRelease().catch((): Record<string, string> => ({})),
  ]);

  /**
   * The release before this one, by version rather than by date: the
   * regression run that gates a release's dev phase belongs to the version
   * immediately below it, and close stamps are too unreliable to order by.
   *
   * Read from the full close map, not from the releases loaded here — the
   * release below the one on screen may well not be loaded.
   */
  const closed = Object.keys(regressionCloses).sort(
    (a, b) => (versionRank(b) ?? 0) - (versionRank(a) ?? 0),
  );
  const previousOf = (release: string): string | null => {
    const rank = versionRank(release) ?? 0;
    return closed.find((r) => (versionRank(r) ?? 0) < rank) ?? null;
  };

  const timelines = Object.fromEntries(
    releases.map((release) => {
      const forRelease = [...runs, ...counterparts].filter(
        (r) => releaseOfRun(r.title) === release,
      );
      const previous = previousOf(release);
      return [
        release,
        buildReleaseTimeline({
          release,
          dev: forRelease.find((r) => !isRegressionRun(r.title)) ?? null,
          regression: forRelease.find((r) => isRegressionRun(r.title)) ?? null,
          previousRelease: previous,
          previousRegressionClosedAt: previous
            ? (regressionCloses[previous] ?? null)
            : null,
          issueArrivedAt: moves.arrivals[release] ?? null,
        }),
      ];
    }),
  );

  return { runs, timelines, isSample };
}
