import type { ReleaseDuration } from "@/lib/testiny/queries";

function PhaseBar({
  label,
  days,
  inProgress,
  maxDays,
  barClass,
}: {
  label: string;
  days: number;
  inProgress: boolean;
  maxDays: number;
  barClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barClass} ${inProgress ? "opacity-60" : ""}`}
          style={{ width: `${Math.min(100, (days / maxDays) * 100)}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs text-slate-600">
        {days}d{inProgress && <span className="text-slate-400"> · running</span>}
      </span>
    </div>
  );
}

/** Per-release testing time: feature pass and regression pass, in days. */
export function ReleaseDurationsCard({
  releases,
}: {
  releases: ReleaseDuration[];
}) {
  const maxDays = Math.max(
    1,
    ...releases.flatMap((r) => [r.feature?.days ?? 0, r.regression?.days ?? 0]),
  );

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Release testing time
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        From each phase&apos;s first Testiny run opening to its last run
        closing — feature testing validates the release, regression clears it
        for production.
      </p>
      <div className="mt-5 space-y-4">
        {releases.map((release) => (
          <div key={release.rank}>
            <p className="font-display text-sm font-semibold text-slate-800">
              {release.release}
            </p>
            <div className="mt-1.5 space-y-1.5">
              {release.feature && (
                <PhaseBar
                  label="Feature"
                  days={release.feature.days}
                  inProgress={release.feature.inProgress}
                  maxDays={maxDays}
                  barClass="bg-brand-600"
                />
              )}
              {release.regression && (
                <PhaseBar
                  label="Regression"
                  days={release.regression.days}
                  inProgress={release.regression.inProgress}
                  maxDays={maxDays}
                  barClass="bg-accent-400"
                />
              )}
            </div>
          </div>
        ))}
        {releases.length === 0 && (
          <p className="text-sm text-slate-500">No runs with release numbers yet.</p>
        )}
      </div>
    </section>
  );
}
