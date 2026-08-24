import { Hero } from "@/components/Hero";
import { RunCard } from "@/components/RunCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getReleaseContent } from "@/lib/release-content";
import { getRunSummariesByState } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

const versionOf = (title: string): string | null =>
  title.match(/(\d+\.\d+)/)?.[1] ?? null;

/** Shared server view for the Active / Closed release pages. */
export async function RunsView({ state }: { state: "active" | "closed" }) {
  await requireAccess("/releases");
  const [{ isSample, runs }, releaseContent] = await Promise.all([
    getRunSummariesByState(state),
    getReleaseContent(),
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

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {runs.map((run) => {
            const version = versionOf(run.title);
            return (
              <RunCard
                key={run.id}
                run={run}
                releaseNumber={version ?? undefined}
                releaseContent={version ? releaseContent[version] : undefined}
              />
            );
          })}
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
