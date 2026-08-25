import { RunsBoard } from "@/app/(app)/releases/RunsBoard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { fetchProductionReleases } from "@/lib/linear/releases";
import {
  isRegressionRun,
  releaseOfRun,
} from "@/lib/release-progression";
import { buildReleaseTimeline } from "@/lib/release-timeline";
import {
  getCounterpartRunSummaries,
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
   * One timeline per release on this page, dated from execution stamps and
   * the Linear release pipeline. Both are cached reads; the counterpart
   * lookup adds a results call only when a release's other phase lives on
   * the opposite board.
   */
  const releases = [
    ...new Set(
      runs.map((r) => releaseOfRun(r.title)).filter((v): v is string => !!v),
    ),
  ];
  const [counterparts, pipeline] = await Promise.all([
    getCounterpartRunSummaries(releases, state),
    fetchProductionReleases().catch(() => null),
  ]);
  const pipelineBy = new Map((pipeline ?? []).map((p) => [p.release, p]));
  const timelines = Object.fromEntries(
    releases.map((release) => {
      const forRelease = [...runs, ...counterparts].filter(
        (r) => releaseOfRun(r.title) === release,
      );
      const entry = pipelineBy.get(release);
      return [
        release,
        buildReleaseTimeline({
          release,
          dev: forRelease.find((r) => !isRegressionRun(r.title)) ?? null,
          regression: forRelease.find((r) => isRegressionRun(r.title)) ?? null,
          stagingAt: entry?.stagingAt ?? null,
          releasedAt: entry?.liveAt ?? null,
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
