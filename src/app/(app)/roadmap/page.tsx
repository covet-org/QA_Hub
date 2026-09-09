import type { Metadata } from "next";
import { getRoadmapDescopes } from "@/lib/roadmap-descopes";
import { ReleaseBoard } from "@/components/ReleaseBoard";
import { env } from "@/lib/env";
import { getRoadmapSnapshot } from "@/lib/roadmap";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  await requireAccess("/roadmap");
  const snapshot = await getRoadmapSnapshot();
  // Awaited, because descoped tickets sort to the top and a list cannot
  // be ordered by data that has not arrived — but only for the group the
  // board opens on. Reading issue history for every roadmap project meant
  // waiting on the slowest call in the app for groups sitting behind a
  // filter nobody had opened; the rest load when a viewer picks them.
  const openingGroups = snapshot.groups.some(
    (g) => g.name === env.roadmapDefaultGroup,
  )
    ? [env.roadmapDefaultGroup]
    : snapshot.groups.map((g) => g.name);
  const descopes = await getRoadmapDescopes(openingGroups);
  const missing = snapshot.totalTickets - snapshot.coveredTickets;
  const coveragePct =
    snapshot.totalTickets > 0
      ? Math.round((snapshot.coveredTickets / snapshot.totalTickets) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        kicker="QA Vision"
        title="QA Roadmap"
        description="Feature tickets from Linear releases — Medium to Big Size Features and Quick wins — matched against Testiny to show which already have test cases and which still need them."
        footnote="Linear releases · Testiny coverage by COV-id folders"
      />
      <PageShell>
        {snapshot.isSample && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <span className="font-semibold">Linear snapshot data.</span> Set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px]">
              LINEAR_API_KEY
            </code>{" "}
            to pull tickets live. Test-case coverage is checked live against
            Testiny either way.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Roadmap tickets"
            value={snapshot.totalTickets}
            hint="Labeled Medium/Big features & Quick wins"
          />
          <StatCard
            label="With test cases"
            value={snapshot.coveredTickets}
            hint={`${coveragePct}% coverage`}
          />
          <StatCard
            label="Missing test cases"
            value={missing}
            hint="Need Testiny folders"
          />
        </div>

        <ReleaseBoard
          groups={snapshot.groups}
          defaultGroup={env.roadmapDefaultGroup}
          descopes={descopes}
          loadedGroups={openingGroups}
        />
      </PageShell>
    </div>
  );
}
