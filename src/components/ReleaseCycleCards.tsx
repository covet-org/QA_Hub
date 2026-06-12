import {
  CYCLE_WINDOW_DAYS,
  type ReleaseCycle,
  type ReleaseCycleStatus,
} from "@/lib/linear/cycle";
import { formatWorkingHours } from "@/lib/worktime";

const KIND_COLORS = {
  feature: "bg-brand-600",
  bug: "bg-rose-400",
} as const;

function KindBar({
  label,
  colorClass,
  avgHours,
  samples,
  maxHours,
}: {
  label: string;
  colorClass: string;
  avgHours: number;
  samples: number;
  maxHours: number;
}) {
  return (
    <div
      className="flex items-center gap-2"
      title={`${label} · avg ${formatWorkingHours(avgHours)} over ${samples} moves`}
    >
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${Math.max(2, (avgHours / maxHours) * 100)}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs text-slate-600">
        {formatWorkingHours(avgHours)}
      </span>
    </div>
  );
}

function StatusRow({
  status,
  maxHours,
}: {
  status: ReleaseCycleStatus;
  maxHours: number;
}) {
  return (
    <div>
      <p className="text-sm text-slate-700">{status.status}</p>
      <div className="mt-1 space-y-1">
        {status.feature && (
          <KindBar
            label="Features"
            colorClass={KIND_COLORS.feature}
            avgHours={status.feature.avgHours}
            samples={status.feature.samples}
            maxHours={maxHours}
          />
        )}
        {status.bug && (
          <KindBar
            label="Bugs"
            colorClass={KIND_COLORS.bug}
            avgHours={status.bug.avgHours}
            samples={status.bug.samples}
            maxHours={maxHours}
          />
        )}
      </div>
    </div>
  );
}

/** One chart per release: cycle time by status, features vs bugs. */
export function ReleaseCycleCards({ releases }: { releases: ReleaseCycle[] }) {
  if (releases.length === 0) return null;

  // Shared scale across all releases so charts are comparable.
  const maxHours = Math.max(
    1,
    ...releases.flatMap((r) =>
      r.statuses.flatMap((s) => [
        s.feature?.avgHours ?? 0,
        s.bug?.avgHours ?? 0,
      ]),
    ),
  );

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Cycle time per release
        </h2>
        <div className="flex gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${KIND_COLORS.feature}`} />
            Features
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${KIND_COLORS.bug}`} />
            Bugs
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Average working time per status within each release — features and
        bugs separated. 8-hour workdays, weekends excluded, last{" "}
        {CYCLE_WINDOW_DAYS} days.
      </p>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
        {releases.map((release) => (
          <div
            key={release.rank}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <h3 className="font-display text-base font-semibold text-slate-800">
              {release.release}
            </h3>
            <div className="mt-4 space-y-3.5">
              {release.statuses.map((status) => (
                <StatusRow
                  key={status.status}
                  status={status}
                  maxHours={maxHours}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
