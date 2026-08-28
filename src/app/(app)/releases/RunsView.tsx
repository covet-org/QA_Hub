import { RunsBoard } from "@/app/(app)/releases/RunsBoard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import {
  fetchReleaseProjectMoves,
  type ReleaseProjectMoves,
} from "@/lib/linear/releases";
import { isRegressionRun, releaseOfRun } from "@/lib/release-progression";
import { buildReleaseTimeline } from "@/lib/release-timeline";
import { versionRank } from "@/lib/release-utils";
import {
  getCounterpartRunSummaries,
  getRegressionCloseByRelease,
  getRunSummariesByState,
} from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell } from "@/components/ui";

/**
 * Shared server view for the Active / Closed release pages.
 *
 * Deliberately fetches ONLY the Testiny run summaries. Per-release
 * stories and bugs (which cost a full Linear roadmap + bugs pull) load
 * from a server action when a viewer expands a release — see
 * lib/release-actions.ts.
 */
export async function RunsView({ state }: { state: "active" | "closed" }) {
  await requireAccess("/releases");
  const { isSample, runs } = await getRunSummariesByState(state);
  const isActive = state === "active";

  /**
   * One timeline per release on this page, dated against the real process:
   * dev testing opens when the previous release's regression run closes,
   * sandbox testing opens when the first issue is moved into the release
   * project and closes with the sandbox run, and regression is bracketed by
   * its run being created and closed. Every step is something this team
   * does, which is why the pipeline's staging and release dates are no
   * longer read here. All cached; the counterpart lookup adds a results
   * call only when a release's other phase lives on the opposite board.
   */
  const releases = [
    ...new Set(
      runs.map((r) => releaseOfRun(r.title)).filter((v): v is string => !!v),
    ),
  ];
  const [counterparts, moves, regressionCloses] = await Promise.all([
    getCounterpartRunSummaries(releases, state),
    // Scoped to the releases on this page: the arrivals query reads issue
    // history, so it is the one expensive read here and there is no
    // reason to ask about releases nobody is looking at.
    fetchReleaseProjectMoves(releases.map((r) => `${r} Release`)).catch(
      (): ReleaseProjectMoves => ({ arrivals: {}, descopesByFeature: {} }),
    ),
    getRegressionCloseByRelease().catch((): Record<string, string> => ({})),
  ]);
  /**
   * The release before this one, by version rather than by date: the
   * regression run that gates a release's dev phase belongs to the version
   * immediately below it, and close stamps are too unreliable to order by.
   */
  const closedReleases = Object.keys(regressionCloses).sort(
    (a, b) => (versionRank(b) ?? 0) - (versionRank(a) ?? 0),
  );
  const previousOf = (release: string): string | null => {
    const rank = versionRank(release) ?? 0;
    return closedReleases.find((r) => (versionRank(r) ?? 0) < rank) ?? null;
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

  return (
    <div>
      <PageHeader
        kicker={`Release Readiness · ${isActive ? "Active" : "Closed"}`}
        title={isActive ? "Active Runs" : "Closed Runs"}
        description={
          isActive
            ? "Test runs currently in execution — feature testing and regression for the releases in flight, live from Testiny."
            : "Completed test runs from past releases — the execution record per release, live from Testiny."
        }
        footnote="Testiny · QA CoVet"
      />
      <PageShell>
        {isSample && <SampleDataNotice />}

        <RunsBoard
          runs={runs}
          timelines={timelines}
          emptyLabel={`No ${isActive ? "active" : "closed"} test runs.`}
        />
      </PageShell>
    </div>
  );
}
