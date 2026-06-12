import { Hero } from "@/components/Hero";
import { RunCard } from "@/components/RunCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getRunSummariesByState } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

/** Shared server view for the Active / Closed release pages. */
export async function RunsView({ state }: { state: "active" | "closed" }) {
  await requireAccess("/releases");
  const { isSample, runs } = await getRunSummariesByState(state);
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
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
        {isSample && <SampleDataNotice />}

        <div className="grid gap-4 md:grid-cols-2">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
          {runs.length === 0 && (
            <p className="text-sm text-slate-500">
              No {isActive ? "active" : "closed"} test runs.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
