import { Card, CardBody, CardHeader } from "@/components/Card";
import { Hero } from "@/components/Hero";
import { AllocationBar } from "@/components/AllocationBar";
import { CycleTimeCard } from "@/components/CycleTimeCard";
import { ReleaseCycleCards } from "@/components/ReleaseCycleCards";
import { ReleaseDurationsCard } from "@/components/ReleaseDurationsCard";
import { StatCard } from "@/components/StatCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { initiatives, overallEffortSplit } from "@/content/initiatives";
import { getBugCycleStats, getReleaseCycleStats } from "@/lib/linear/cycle";
import {
  getManualTestingSnapshot,
  getReleaseDurations,
} from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

interface HomePageProps {
  searchParams: Promise<{ denied?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [viewer, snapshot, durations, cycleStats, releaseCycles, { denied }] =
    await Promise.all([
      requireAccess("/"),
      getManualTestingSnapshot(),
      getReleaseDurations(),
      getBugCycleStats(),
      getReleaseCycleStats(),
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

      <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
        {denied && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
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

        <Card>
          <CardHeader
            title="Current effort allocation"
            subtitle="Average split across active roadmap initiatives. The department goal is to grow the automation share release over release."
          />
          <CardBody>
            <AllocationBar
              manual={split.manual}
              automation={split.automation}
            />
          </CardBody>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ReleaseDurationsCard releases={durations.releases} />
          <CycleTimeCard cycles={cycleStats.cycles} />
        </div>

        <ReleaseCycleCards releases={releaseCycles.releases} />
      </div>
    </div>
  );
}
