import type { Metadata } from "next";
import { CycleTimeCard } from "@/components/CycleTimeCard";
import { ReleaseCycleCards } from "@/components/ReleaseCycleCards";
import { ReleaseDurationsCard } from "@/components/ReleaseDurationsCard";
import { getBugCycleStats, getReleaseCycleStats } from "@/lib/linear/cycle";
import { getReleaseDurations } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell } from "@/components/ui";

export const metadata: Metadata = { title: "Release metrics" };

/**
 * The slower analytics, off Home's critical path.
 *
 * Two of these three read Linear issue history across a ninety-day window
 * — fifty issues a page, each carrying a hundred history events — which
 * was the most expensive blocking read Home had, and it ran on every
 * visit to a page most people open to check today's numbers.
 *
 * They are trend charts: nobody watches them minute to minute, and paying
 * for them only when someone comes looking is the right trade. Home keeps
 * what is checked constantly; this keeps what is studied occasionally.
 *
 * Access is gated on "/" — the same section Home belongs to — because the
 * viewer role model keys on the top-level entry, not on sub-pages.
 */
export default async function ReleaseMetricsPage() {
  await requireAccess("/");

  const [durations, cycleStats, releaseCycles] = await Promise.all([
    getReleaseDurations(),
    getBugCycleStats(),
    getReleaseCycleStats(),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Home · Release metrics"
        title="Release metrics"
        description="How long testing takes and how long bugs sit, release over release. Trends rather than today's state — the boards carry that."
        footnote="Linear · Testiny"
      />
      <PageShell>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ReleaseDurationsCard releases={durations.releases} />
          <CycleTimeCard cycles={cycleStats.cycles} />
        </div>

        <ReleaseCycleCards releases={releaseCycles.releases} />
      </PageShell>
    </div>
  );
}
