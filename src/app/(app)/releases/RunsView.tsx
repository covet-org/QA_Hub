import { Hero } from "@/components/Hero";
import { RunsBoard } from "@/app/(app)/releases/RunsBoard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getDescopeSnapshot } from "@/lib/linear/descope";
import { getRunSummariesByState } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

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
  // Descope detection reads Linear issue history and never throws — a
  // failure there degrades to a notice instead of taking the runs down.
  const [{ isSample, runs }, descopes] = await Promise.all([
    getRunSummariesByState(state),
    getDescopeSnapshot(),
  ]);
  const isActive = state === "active";

  return (
    <div>
      <Hero
        kicker={`Release Readiness · ${isActive ? "Active" : "Closed"}`}
        title={isActive ? "Active Runs" : "Closed Runs"}
        description={
          isActive
            ? "Test runs currently in execution — feature testing and regression for the releases in flight, live from Testiny."
            : "Completed test runs from past releases — the execution record per release, live from Testiny."
        }
        footnote="Testiny · QA CoVet"
      />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
        {isSample && <SampleDataNotice />}

        <RunsBoard
          runs={runs}
          emptyLabel={`No ${isActive ? "active" : "closed"} test runs.`}
          descopes={descopes}
        />
      </div>
    </div>
  );
}
