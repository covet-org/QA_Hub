import { AllocationBar } from "@/components/AllocationBar";
import { CycleTimeCard } from "@/components/CycleTimeCard";
import { ReleaseCycleCards } from "@/components/ReleaseCycleCards";
import { ReleaseDurationsCard } from "@/components/ReleaseDurationsCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { initiatives, overallEffortSplit } from "@/content/initiatives";
import { BugTrendChart } from "@/components/BugTrendChart";
import { ReleaseFeatures } from "@/components/ReleaseFeatures";
import { getBugTrends } from "@/lib/bugs";
import { getReleaseContent } from "@/lib/release-content";
import { versionRank } from "@/lib/release-utils";
import { getBugCycleStats, getReleaseCycleStats } from "@/lib/linear/cycle";
import {
  getReleaseDurations,
  getRunSummariesByState,
} from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  PageShell,
  StatCard,
} from "@/components/ui";

interface HomePageProps {
  searchParams: Promise<{ denied?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [
    viewer,
    activeRunsResult,
    durations,
    cycleStats,
    releaseCycles,
    trends,
    releaseContent,
    { denied },
  ] = await Promise.all([
    requireAccess("/"),
    getRunSummariesByState("active"),
    getReleaseDurations(),
    getBugCycleStats(),
    getReleaseCycleStats(),
    getBugTrends(),
    // Same release content the Releases page uses; the underlying reads
    // are shared with the bug trends above via the request cache.
    getReleaseContent(),
    searchParams,
  ]);

  const split = overallEffortSplit();
  const inProgress = initiatives.filter(
    (i) => i.status === "in-progress",
  ).length;
  const activeRuns = activeRunsResult.runs.length;
  const currentRelease = trends[0];
  // Newest release first, and only releases that actually shipped features.
  const featureGroups = Object.entries(releaseContent)
    .map(([release, content]) => ({
      release,
      rank: versionRank(release) ?? 0,
      stories: content.stories,
    }))
    .sort((a, b) => b.rank - a.rank);
  const firstName = viewer.name.split(" ")[0] || "there";

  return (
    <div>
      <PageHeader
        kicker="QA Department"
        title="QA Hub"
        description={`Welcome back, ${firstName}. Everything the QA team is working on — manual coverage, automation progress and release readiness in one place.`}
        footnote="Linear · Testiny"
      />

      <PageShell>
        {denied && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            You don&apos;t have access to that section. Ask a QA lead if you
            think you should.
          </div>
        )}
        {activeRunsResult.isSample && <SampleDataNotice />}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Initiatives in progress"
            value={inProgress}
            hint={`${initiatives.length} total on the roadmap`}
          />
          <StatCard
            label={`Bugs in ${currentRelease?.release ?? "this release"}`}
            value={currentRelease?.total ?? 0}
            hint="Filed against the current release"
            tone={
              currentRelease && currentRelease.total > 0 ? "danger" : "brand"
            }
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

        <Card>
          <CardHeader
            title="Bugs found per release"
            subtitle="Cumulative bugs filed against each release, counted from its first bug so the curves compare directly. A steeper line means bugs surfacing faster."
          />
          <CardBody>
            <BugTrendChart trends={trends} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Features per release"
            subtitle="What actually went out in each release — the same releases as the chart above, seen as content rather than counts. Newest release open; the rest fold away."
          />
          <CardBody>
            <ReleaseFeatures groups={featureGroups} />
          </CardBody>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ReleaseDurationsCard releases={durations.releases} />
          <CycleTimeCard cycles={cycleStats.cycles} />
        </div>

        <ReleaseCycleCards releases={releaseCycles.releases} />
      </PageShell>
    </div>
  );
}
