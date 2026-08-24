import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { ReleaseBoard } from "@/components/ReleaseBoard";
import { StatCard } from "@/components/StatCard";
import { getRoadmapSnapshot } from "@/lib/roadmap";
import { requireAccess } from "@/lib/viewer";

export const metadata: Metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  await requireAccess("/roadmap");
  const snapshot = await getRoadmapSnapshot();
  const missing = snapshot.totalTickets - snapshot.coveredTickets;
  const coveragePct =
    snapshot.totalTickets > 0
      ? Math.round((snapshot.coveredTickets / snapshot.totalTickets) * 100)
      : 0;

  return (
    <div>
      <Hero
        kicker="QA Vision"
        title="QA Roadmap"
        description="Feature tickets from Linear releases — Medium to Big Size Features and Quick wins — matched against Testiny to show which already have test cases and which still need them."
        footnote="Linear releases · Testiny coverage by COV-id folders"
      />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
        {snapshot.isSample && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Linear snapshot data.</span> Set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">
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

        <ReleaseBoard groups={snapshot.groups} />
      </div>
    </div>
  );
}
