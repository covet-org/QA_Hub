import { Hero } from "@/components/Hero";
import { AllocationBar } from "@/components/AllocationBar";
import { CycleTimeCard } from "@/components/CycleTimeCard";
import { ReleaseDurationsCard } from "@/components/ReleaseDurationsCard";
import { StatCard } from "@/components/StatCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { initiatives, overallEffortSplit } from "@/content/initiatives";
import { getBugCycleStats } from "@/lib/linear/cycle";
import {
  getManualTestingSnapshot,
  getReleaseDurations,
} from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

interface HomePageProps {
  searchParams: Promise<{ denied?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [viewer, snapshot, durations, cycleStats, { denied }] =
    await Promise.all([
      requireAccess("/"),
      getManualTestingSnapshot(),
      getReleaseDurations(),
      getBugCycleStats(),
      searchParams,
    ]);

  const split = overallEffortSplit();
  const inProgress = initiatives.filter((i) => i.status === "in-progress").length;
  const activeRuns = snapshot.runs.filter((r) => !r.isClosed).length;
  const firstName =
    viewer.kind === "member" ? (viewer.name.split(" ")[0] ?? "there") : "there";

  return (
    <div>
      <Hero
        kicker="QA Department"
        title="QA Brain"
        description={`Welcome back, ${firstName}. Everything the QA team is working on — manual coverage, automation progress and release readiness in one place.`}
        footnote={`Testiny · ${snapshot.projectName}`}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
        {denied && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            You don&apos;t have access to that section. Ask a QA lead if you
            think you should.
          </div>
        )}
        {snapshot.isSample && <SampleDataNotice />}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Initiatives in progress"
            value={inProgress}
            hint={`${initiatives.length} total on the roadmap`}
          />
          <StatCard
            label="Manual test cases"
            value={snapshot.totalTestCases}
            hint="In Testiny"
          />
          <StatCard
            label="Active test runs"
            value={activeRuns}
            hint="Open in Testiny"
          />
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Current effort allocation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Average split across active roadmap initiatives. The department
            goal is to grow the automation share release over release.
          </p>
          <div className="mt-5 max-w-xl">
            <AllocationBar manual={split.manual} automation={split.automation} />
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ReleaseDurationsCard releases={durations.releases} />
          <CycleTimeCard cycles={cycleStats.cycles} />
        </div>
      </div>
    </div>
  );
}
