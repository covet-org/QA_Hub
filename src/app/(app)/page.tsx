import { AllocationBar } from "@/components/AllocationBar";
import { CycleTimeCard } from "@/components/CycleTimeCard";
import { ReleaseCycleCards } from "@/components/ReleaseCycleCards";
import { ReleaseDurationsCard } from "@/components/ReleaseDurationsCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { overallEffortSplit } from "@/content/initiatives";
import { BugTrendChart } from "@/components/BugTrendChart";
import { ReleaseFeatures } from "@/components/ReleaseFeatures";
import {
  currentPhase,
  pickReleaseProgression,
} from "@/lib/release-progression";
import { getBugTrends, getCsBugTrends } from "@/lib/bugs";
import { getReleaseContent } from "@/lib/release-content";
import { versionRank } from "@/lib/release-utils";
import { getBugCycleStats, getReleaseCycleStats } from "@/lib/linear/cycle";
import {
  getReleaseDurations,
  getRunSummariesByState,
} from "@/lib/testiny/queries";
import { allowedHrefs, requireAccess } from "@/lib/viewer";
import { slugify } from "@/lib/slug";
import { DEFAULT_RELEASES_SHOWN } from "@/lib/release-window";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  RunProgressBar,
  runProgress,
  UnderDevelopment,
  PageHeader,
  PageShell,
  StatCard,
} from "@/components/ui";

/** "Regression 3.36" -> 3.36; run titles carry the version in prose. */
const RELEASE_IN_TITLE = /(\d+\.\d+)/;

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
    csBugs,
    releaseContent,
    { denied },
  ] = await Promise.all([
    requireAccess("/"),
    getRunSummariesByState("active"),
    getReleaseDurations(),
    getBugCycleStats(),
    getReleaseCycleStats(),
    getBugTrends(),
    // Same CS tickets the CS bug board reads and the same Testiny runs
    // the release testing card reads — both already cached.
    getCsBugTrends(),
    // Same release content the Releases page uses; the underlying reads
    // are shared with the bug trends above via the request cache.
    getReleaseContent(),
    searchParams,
  ]);

  const split = overallEffortSplit();
  const activeRuns = activeRunsResult.runs.length;
  /**
   * Closed runs are only fetched when nothing is in testing. Summarising
   * them means a results call per run, so paying for it on every Home
   * load — to answer a question the active runs already answer — would
   * be the kind of cost that made this page slow in the first place.
   */
  const closedRuns =
    activeRuns > 0 ? [] : (await getRunSummariesByState("closed")).runs;
  const progression = pickReleaseProgression(
    activeRunsResult.runs,
    closedRuns,
  );
  // One number, and which phase it belongs to: dev and regression never
  // run at once, so the release has a single current percentage.
  const phase = progression ? currentPhase(progression) : null;
  const phaseProgress = phase ? runProgress(phase.run) : null;
  const currentRelease = trends[0];

  // Only link where this viewer may actually go: access is by parent
  // href, so a link to a section above their role would bounce them to
  // /?denied=1 — a worse answer than no link.
  const allowed = new Set(allowedHrefs(viewer));
  const linkTo = (parent: string, href: string) =>
    allowed.has(parent) ? href : undefined;

  // One release window for both cards: the chart's order wins, so the two
  // always open on the same releases. Sorting features by version number
  // instead put an unreleased 3.37 — with nothing in it — above the 3.36
  // the chart was showing.
  const trendOrder = new Map(trends.map((t, i) => [t.release, i]));
  const featureGroups = Object.entries(releaseContent)
    .map(([release, content]) => ({
      release,
      rank: versionRank(release) ?? 0,
      stories: content.stories,
    }))
    .sort((a, b) => {
      const ai = trendOrder.get(a.release);
      const bi = trendOrder.get(b.release);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      // A release the chart doesn't know about (no bugs yet) sits behind
      // the ones it does, newest of those first.
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return b.rank - a.rank;
    });

  // What each card is showing: the same slice its "+ More" hides, so a
  // click lands on the releases the reader was just looking at.
  const shownIn = (releases: string[]) =>
    releases.slice(0, DEFAULT_RELEASES_SHOWN);
  const trendReleases = shownIn(trends.map((t) => t.release));
  const csReleases = shownIn(csBugs.trends.map((t) => t.release));
  const featureReleases = shownIn(featureGroups.map((g) => g.release));
  const activeRunVersions = [
    ...new Set(
      activeRunsResult.runs
        .map((run) => run.title.match(RELEASE_IN_TITLE)?.[1])
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  /**
   * A link carries the card's own query, so the board opens on what the
   * reader was just looking at rather than on everything. The two sides
   * name releases differently and both are load-bearing: the bug boards
   * group by Linear project ("3.36 Release"), the run boards by bare
   * version ("3.36").
   */
  const releaseParam = (releases: string[], suffix: "" | " Release") =>
    releases.map((r) => slugify(`${r}${suffix}`)).join(",");

  const boardHref = (path: string, releases: string[]) =>
    linkTo(
      "/bugs",
      releases.length > 0
        ? `${path}?release=${releaseParam(releases, " Release")}`
        : path,
    );

  /**
   * Runs are split across two boards by whether their Testiny runs are
   * still open, so a link has to pick the one holding these releases.
   * Sending the feature breakdown to /releases/active looked right and
   * landed on an empty board: only 3.37 is active, while the features
   * shown are 3.36 and 3.35, which are closed.
   */
  const runsHref = (versions: string[]) => {
    const active = versions.filter((v) => activeRunVersions.includes(v));
    const onActiveBoard = active.length > 0;
    const board = onActiveBoard ? "/releases/active" : "/releases/closed";
    const scoped = onActiveBoard ? active : versions;
    return linkTo(
      "/releases",
      scoped.length > 0
        ? `${board}?release=${releaseParam(scoped, "")}`
        : board,
    );
  };
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

        {/* Two tiles of one shape: "how far is the release" beside "what
            did it cost us". The progression is the same StatCard as the
            bug count, with its bar in the footer slot — a lookalike built
            separately would drift the first time either changed. */}
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <StatCard
            label={
              progression
                ? `${progression.isActive ? "In testing" : "Last shipped"} · ${phase?.label ?? "no runs"}`
                : "Release progression"
            }
            value={progression?.release ?? "—"}
            hint={
              phaseProgress
                ? `${phaseProgress.percent}% · ${phaseProgress.executed} of ${phase!.run.total} executed`
                : "No Testiny run carries a release number"
            }
            tone={progression?.isActive ? "brand" : "neutral"}
            /**
             * Straight to the board holding this release, filtered to it:
             * runsHref picks active or closed by whether the release has
             * an open run, so a shipped release lands on the closed board
             * showing its dev and regression runs rather than an empty
             * active one.
             */
            href={progression ? runsHref([progression.release]) : undefined}
            footer={phase ? <RunProgressBar run={phase.run} /> : undefined}
          />

          <StatCard
            label={`Bugs reported in ${currentRelease?.release ?? "this release"}`}
            value={currentRelease?.total ?? 0}
            hint={`Filed against ${currentRelease?.release ?? "the release"} in Linear`}
            tone={
              currentRelease && currentRelease.total > 0 ? "danger" : "brand"
            }
            // Straight to that release's rows, not just the board.
            href={boardHref(
              "/bugs/product",
              currentRelease ? [currentRelease.release] : [],
            )}
          />
        </div>

        <Card>
          <CardHeader
            title="Current effort allocation"
            badge="being reworked"
            subtitle="Average split across active roadmap initiatives. The department goal is to grow the automation share release over release."
          />
          <CardBody>
            {/* The last hand-maintained number on this page: it comes from
                content/initiatives.ts, which still describes QA's world as
                of July. Everything else here is read from Linear or
                Testiny on each request. */}
            <UnderDevelopment
              compact
              note="This split comes from a checked-in file, not from Linear or Testiny — treat it as last edited, not as current."
            >
              <AllocationBar
                manual={split.manual}
                automation={split.automation}
              />
            </UnderDevelopment>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Bugs found per release"
            titleHref={boardHref("/bugs/product", trendReleases)}
            subtitle="Cumulative bugs filed against each release, counted from its first bug so the curves compare directly. A steeper line means bugs surfacing faster."
          />
          <CardBody>
            <BugTrendChart trends={trends} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="CS bugs per release"
            titleHref={boardHref("/bugs/cs", csReleases)}
            subtitle="Bugs reported by customer service while each release was the version in production. CS bugs are filed cross-product, so they are attributed by date: a release owns production from its go-live until the next release's. Day 0 is go-live, so the curves compare week for week."
            footnote={
              csBugs.source === "pipeline"
                ? "Go-live from Linear's production release pipeline"
                : csBugs.source === "table"
                  ? "Go-live from the checked-in release table — Linear's release pipeline was unavailable"
                  : undefined
            }
          />
          <CardBody>
            {csBugs.trends.length > 0 ? (
              <BugTrendChart trends={csBugs.trends} />
            ) : (
              <EmptyState>
                No release has a recorded go-live date, so there is no
                production window to attribute CS bugs to yet.
              </EmptyState>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Features per release"
            titleHref={runsHref(featureReleases)}
            subtitle="What actually went out in each release — the same two releases as the chart above, seen as content rather than counts. Newest release open; use + More for older ones."
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
