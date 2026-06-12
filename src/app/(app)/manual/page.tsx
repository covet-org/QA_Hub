import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { StatCard } from "@/components/StatCard";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getManualTestingSnapshot } from "@/lib/testiny/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Manual Testing" };

function DistributionCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {entries.map(([label, value]) => (
          <li key={label}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{label}</span>
              <span className="font-medium text-slate-500">{value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-sm text-slate-500">No data.</li>
        )}
      </ul>
    </div>
  );
}

export default async function ManualTestingPage() {
  await requireRole("qa");
  const snapshot = await getManualTestingSnapshot();

  return (
    <div>
      <Hero
        kicker="Testing · Manual"
        title="Manual Testing"
        description="The manual test inventory in Testiny — coverage by feature area, case types and priorities. This is the effort base that automation will progressively take over."
        footnote={`Testiny · ${snapshot.projectName}`}
      />
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
        {snapshot.isSample && <SampleDataNotice />}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total test cases" value={snapshot.totalTestCases} />
          <StatCard
            label="Feature areas"
            value={snapshot.topFolders.length}
            hint="Top-level Testiny folders"
          />
          <StatCard
            label="Test runs tracked"
            value={snapshot.runs.length}
            hint="Recent runs"
          />
        </div>

        <DistributionCard
          title="Cases by feature area"
          data={Object.fromEntries(
            snapshot.topFolders.map((f) => [f.title, f.caseCount]),
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <DistributionCard title="Cases by type" data={snapshot.casesByType} />
          <DistributionCard
            title="Cases by priority"
            data={snapshot.casesByPriority}
          />
        </div>
      </div>
    </div>
  );
}
