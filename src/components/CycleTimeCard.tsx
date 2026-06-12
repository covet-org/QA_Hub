import {
  CYCLE_WINDOW_DAYS,
  type PriorityCycle,
  type StatusCycle,
} from "@/lib/linear/cycle";
import { formatWorkingHours } from "@/lib/worktime";

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "bg-rose-500",
  High: "bg-amber-400",
  Medium: "bg-sky-500",
  Low: "bg-slate-400",
  "No priority": "bg-slate-300",
};

function PriorityBar({
  slice,
  maxHours,
}: {
  slice: PriorityCycle;
  maxHours: number;
}) {
  const topBugs = slice.bugs
    .slice(0, 3)
    .map((b) => `${b.id} (${formatWorkingHours(b.hours)})`)
    .join(", ");

  return (
    <div
      className="flex items-center gap-2"
      title={`${slice.priority} · avg ${formatWorkingHours(slice.avgHours)} over ${slice.samples} moves${topBugs ? ` · longest: ${topBugs}` : ""}`}
    >
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${PRIORITY_COLORS[slice.priority] ?? "bg-slate-300"}`}
          style={{ width: `${Math.max(2, (slice.avgHours / maxHours) * 100)}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs text-slate-600">
        {formatWorkingHours(slice.avgHours)}
      </span>
    </div>
  );
}

/** Grouped bar chart: working time per status, one bar per priority. */
export function CycleTimeCard({ cycles }: { cycles: StatusCycle[] }) {
  const maxHours = Math.max(
    1,
    ...cycles.flatMap((c) => c.byPriority.map((p) => p.avgHours)),
    ...cycles.map((c) => c.avgHours),
  );

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Bug cycle time by status
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Average working time a bug spends in each status before moving on —
        8-hour workdays, weekends excluded, last {CYCLE_WINDOW_DAYS} days.
      </p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {Object.entries(PRIORITY_COLORS).map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {cycles.map((cycle) => (
          <div key={cycle.status}>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">{cycle.status}</span>
              <span className="text-slate-400">
                avg {formatWorkingHours(cycle.avgHours)} · {cycle.samples} moves
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              {cycle.byPriority.map((slice) => (
                <PriorityBar
                  key={slice.priority}
                  slice={slice}
                  maxHours={maxHours}
                />
              ))}
            </div>
          </div>
        ))}
        {cycles.length === 0 && (
          <p className="text-sm text-slate-500">
            Not enough status changes in the window yet.
          </p>
        )}
      </div>
    </section>
  );
}
