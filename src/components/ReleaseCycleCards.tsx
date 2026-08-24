import {
  CYCLE_WINDOW_DAYS,
  type ReleaseBugCycle,
  type ReleaseCycle,
} from "@/lib/linear/cycle";
import { formatWorkingHours } from "@/lib/worktime";

function BugRow({ bug }: { bug: ReleaseBugCycle }) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline gap-2.5 text-sm">
        <a
          href={bug.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-semibold text-brand-700 hover:underline"
        >
          {bug.id}
        </a>
        <span className="min-w-0 truncate text-slate-800" title={bug.title}>
          {bug.title}
        </span>
        <span className="ml-auto shrink-0 text-xs text-slate-400">
          {formatWorkingHours(bug.totalHours)} total
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
        {bug.stays.map((stay) => (
          <span key={stay.status}>
            {stay.status}{" "}
            <span className="font-medium text-slate-600">
              {formatWorkingHours(stay.hours)}
            </span>
          </span>
        ))}
      </div>
    </li>
  );
}

/** One chart per release: median bug cycle time by status + bug list. */
export function ReleaseCycleCards({ releases }: { releases: ReleaseCycle[] }) {
  if (releases.length === 0) return null;

  // Shared scale across all releases so charts are comparable.
  const maxHours = Math.max(
    1,
    ...releases.flatMap((r) => r.statuses.map((s) => s.medianHours)),
  );

  return (
    <section>
      <h2 className="font-display text-[15px] leading-tight font-semibold text-slate-800">
        Bug cycle time per release
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Median working time bugs spend in each status, per release — 8-hour
        workdays, weekends excluded, last {CYCLE_WINDOW_DAYS} days. Expand a
        release to see every bug&apos;s time per status.
      </p>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
        {releases.map((release) => (
          <div
            key={release.rank}
            className="rounded-xl bg-surface-card p-5 shadow-card ring-1 ring-hairline"
          >
            <h3 className="font-display text-base font-semibold text-slate-800">
              {release.release}
            </h3>

            <div className="mt-4 space-y-2.5">
              {release.statuses.map((status) => (
                <div key={status.status}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">{status.status}</span>
                    <span className="font-medium text-slate-600">
                      {formatWorkingHours(status.medianHours)}
                      <span className="ml-1.5 font-normal text-slate-400">
                        · {status.samples} bug{status.samples === 1 ? "" : "s"}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-rose-400"
                      style={{
                        width: `${Math.max(2, (status.medianHours / maxHours) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <details className="mt-4 border-t border-hairline pt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
                All bugs ({release.bugs.length})
              </summary>
              <ul className="mt-2 max-h-80 divide-y divide-hairline overflow-y-auto">
                {release.bugs.map((bug) => (
                  <BugRow key={bug.id} bug={bug} />
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
