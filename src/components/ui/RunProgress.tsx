/**
 * The stacked execution bar for a Testiny run, and its legend.
 *
 * Lifted out of RunCard so Home can show the same bar without dragging
 * in that card's machinery — RunCard is a client component that fetches
 * release content and descopes on demand, none of which a summary on the
 * landing page wants. Same colours, same order, same arithmetic: two
 * places showing one run's progress must not disagree about it.
 *
 * No directive either way: a server component renders it on Home, a
 * client component renders it inside RunCard.
 */

/** Fixed order, and the colour each state keeps everywhere in the app. */
export const RUN_SEGMENTS = [
  { key: "passed", className: "bg-emerald-500", label: "Passed" },
  { key: "failed", className: "bg-rose-500", label: "Failed" },
  { key: "blocked", className: "bg-amber-400", label: "Blocked" },
  { key: "skipped", className: "bg-slate-300", label: "Skipped" },
  { key: "notRun", className: "bg-slate-200", label: "Not run" },
] as const;

/** Just the counts — deliberately not the whole RunSummary. */
export interface RunProgressLike {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
}

/** Executed cases and the percentage of the run they represent. */
export function runProgress(run: RunProgressLike): {
  executed: number;
  percent: number;
} {
  const executed = run.total - run.notRun;
  return {
    executed,
    percent: run.total > 0 ? Math.round((executed / run.total) * 100) : 0,
  };
}

export function RunProgressBar({
  run,
  className = "",
}: {
  run: RunProgressLike;
  className?: string;
}) {
  return (
    <div
      className={`flex h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/70 ${className}`}
    >
      {RUN_SEGMENTS.map(({ key, className: fill }) => {
        const value = run[key];
        if (!value || run.total === 0) return null;
        return (
          <div
            key={key}
            className={fill}
            style={{ width: `${(value / run.total) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

export function RunProgressLegend({
  run,
  className = "",
}: {
  run: RunProgressLike;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {RUN_SEGMENTS.map(({ key, className: fill, label }) => {
        const value = run[key];
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] ring-1 ring-inset ${
              value
                ? "bg-slate-50 text-slate-600 ring-slate-200"
                : "text-slate-300 ring-transparent"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${value ? fill : "bg-slate-200"}`}
            />
            {label} <span className="nums font-semibold">{value}</span>
          </span>
        );
      })}
    </div>
  );
}
