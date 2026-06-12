import { CYCLE_WINDOW_DAYS, type StatusCycle } from "@/lib/linear/cycle";
import { formatWorkingHours } from "@/lib/worktime";

/** Average working time bugs spend in each workflow status. */
export function CycleTimeCard({ cycles }: { cycles: StatusCycle[] }) {
  const maxHours = Math.max(1, ...cycles.map((c) => c.avgHours));

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Bug cycle time by status
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Average working time a bug spends in each status before moving on —
        8-hour workdays, weekends excluded, last {CYCLE_WINDOW_DAYS} days.
      </p>
      <ul className="mt-5 space-y-2.5">
        {cycles.map((cycle) => (
          <li key={cycle.status}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{cycle.status}</span>
              <span className="font-medium text-slate-600">
                {formatWorkingHours(cycle.avgHours)}
                <span className="ml-1.5 font-normal text-slate-400">
                  · {cycle.samples} moves
                </span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${(cycle.avgHours / maxHours) * 100}%` }}
              />
            </div>
          </li>
        ))}
        {cycles.length === 0 && (
          <li className="text-sm text-slate-500">
            Not enough status changes in the window yet.
          </li>
        )}
      </ul>
    </section>
  );
}
