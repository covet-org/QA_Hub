import { RunsBoard } from "@/app/(app)/releases/RunsBoard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getReleaseBoardData } from "@/lib/release-board";
import { getReleasesByState } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell } from "@/components/ui";

/**
 * Shared server view for the Active / Closed release pages.
 *
 * Opens on the newest release rather than the whole board. Loading every
 * closed release means reading each run's case results and each release
 * project's issue history before anything renders at all — a dozen
 * releases of work to look at one. The rest load when a viewer picks them
 * in the filter.
 *
 * Active loads whole: it is one or two releases in flight, and splitting
 * it would add a round trip to save nothing.
 *
 * Per-release stories and bugs stay on their own lazy path — see
 * lib/release-actions.ts — and cost nothing until a release is expanded.
 */
export async function RunsView({ state }: { state: "active" | "closed" }) {
  await requireAccess("/releases");
  const isActive = state === "active";

  // Cheap: titles off the cached run list, no results behind it. The board
  // needs every release to build its filter even though it has data for
  // one — a filter that hides what you have not opened looks broken.
  const releases = await getReleasesByState(state);
  const initial = isActive ? releases : releases.slice(0, 1);
  const { runs, timelines, isSample } = await getReleaseBoardData(
    state,
    initial,
  );

  return (
    <div>
      <PageHeader
        kicker={`Release Readiness · ${isActive ? "Active" : "Closed"}`}
        title={isActive ? "Active Runs" : "Closed Runs"}
        description={
          isActive
            ? "Test runs currently in execution — feature testing and regression for the releases in flight, live from Testiny."
            : "Completed test runs from past releases — the execution record per release, live from Testiny. Opens on the newest; pick another release to load it."
        }
        footnote="Testiny · QA CoVet"
      />
      <PageShell>
        {isSample && <SampleDataNotice />}

        <RunsBoard
          state={state}
          initialRuns={runs}
          initialTimelines={timelines}
          allReleases={releases}
          loadedReleases={initial}
          emptyLabel={`No ${isActive ? "active" : "closed"} test runs.`}
        />
      </PageShell>
    </div>
  );
}
