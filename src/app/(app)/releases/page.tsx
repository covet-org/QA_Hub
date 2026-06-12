import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { RunCard } from "@/components/RunCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getManualTestingSnapshot } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

export const metadata: Metadata = { title: "Releases" };

export default async function ReleasesPage() {
  await requireAccess("/releases");
  const snapshot = await getManualTestingSnapshot();

  const active = snapshot.runs.filter((r) => !r.isClosed);
  const closed = snapshot.runs.filter((r) => r.isClosed);

  return (
    <div>
      <Hero
        kicker="Release Readiness"
        title="Releases"
        description="Test execution status per release — feature testing and regression runs pulled live from Testiny."
        footnote={`Testiny · ${snapshot.projectName}`}
      />
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8 sm:px-10">
        {snapshot.isSample && <SampleDataNotice />}

        <section>
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Active runs
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {active.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
            {active.length === 0 && (
              <p className="text-sm text-slate-500">No active test runs.</p>
            )}
          </div>
        </section>

        {closed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Recently closed
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {closed.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
