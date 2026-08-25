import type { Metadata } from "next";
import { SampleDataNotice } from "@/components/SampleDataNotice";
import { getManualTestingSnapshot } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";
import {
  PageHeader,
  PageShell,
  StatCard,
  UnderDevelopment,
} from "@/components/ui";

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
    <div className="rounded-xl bg-surface-card p-4 shadow-card ring-1 ring-hairline">
      <h3 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {entries.map(([label, value]) => (
          <li key={label}>
            <div className="flex justify-between text-[13px]">
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
          <li className="text-[13px] text-slate-500">No data.</li>
        )}
      </ul>
    </div>
  );
}

export default async function ManualTestingPage() {
  await requireAccess("/manual");
  const snapshot = await getManualTestingSnapshot();

  return (
    <div>
      <PageHeader
        kicker="Testing · Manual"
        title="Manual Testing"
        description="The manual test inventory in Testiny — coverage by feature area, case types and priorities. This is the effort base that automation will progressively take over."
        footnote={`Testiny · ${snapshot.projectName}`}
      />
      <UnderDevelopment>
        <PageShell>
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
        </PageShell>
      </UnderDevelopment>
    </div>
  );
}
