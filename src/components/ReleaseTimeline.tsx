"use client";

import type { ReleaseTimeline as Timeline } from "@/lib/release-timeline";

/**
 * The release's steps as a dated rail: sandbox → staging → regression →
 * released.
 *
 * Every date comes from an execution timestamp or the Linear release
 * pipeline, never from when a Testiny run was marked closed — those are
 * batched days later and would date every release to the same afternoon.
 *
 * A step with no date says why rather than showing a blank, because "no
 * regression run yet" and "regression not started" are different facts
 * and a QA lead acts differently on each.
 */
/**
 * Weekday first, and deliberately: the process runs to weekdays — dev
 * Monday to Wednesday, sandbox opening Thursday, release on Monday — so a
 * step that slipped is only visible if the day name is on the row. Local
 * to the reader, which is also the only timezone we can be right about.
 */
function stamp(iso: string): string {
  const at = new Date(iso);
  return at.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gap(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m later`;
  if (hours < 48) return `${hours}h later`;
  return `${Math.round((hours / 24) * 10) / 10}d later`;
}

export function ReleaseTimelineRail({ timeline }: { timeline: Timeline }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Release steps
        </p>
        {timeline.spanDays !== null && (
          <p className="nums text-[11px] text-slate-500">
            {timeline.spanDays}d end to end
          </p>
        )}
      </div>

      <ol className="mt-2.5 space-y-0">
        {timeline.milestones.map((m, index) => {
          const last = index === timeline.milestones.length - 1;
          const dated = m.at !== null;
          return (
            <li key={m.key} className="flex gap-2.5">
              {/* Rail: a filled dot for something that happened, hollow
                  for something still ahead. */}
              <div
                aria-hidden
                className="flex w-3 shrink-0 flex-col items-center"
              >
                <span
                  className={`mt-1.5 size-2 rounded-full ${
                    dated
                      ? "bg-brand-600"
                      : "bg-surface-card ring-1 ring-slate-300"
                  }`}
                />
                {!last && (
                  <span
                    className={`w-px flex-1 ${dated ? "bg-brand-200" : "bg-slate-200"}`}
                  />
                )}
              </div>

              <div className={`min-w-0 flex-1 ${last ? "" : "pb-2.5"}`}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`text-[12px] ${dated ? "text-slate-800" : "text-slate-400"}`}
                    title={m.source}
                  >
                    {m.label}
                  </span>
                  {dated ? (
                    <span className="nums text-[11px] text-slate-500">
                      {stamp(m.at!)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      {m.pending}
                    </span>
                  )}
                  {m.hoursFromPrevious !== null && (
                    <span className="nums text-[10px] text-slate-400">
                      {gap(m.hoursFromPrevious)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Where this release left the process. The amber is the point of the
          section: a rail of dates nobody reads is worth less than one line
          saying which step moved. */}
      {timeline.flags.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {timeline.flags.map((note) => (
            <li
              key={note}
              className="flex items-start gap-1.5 text-[11px] text-amber-800"
            >
              <span aria-hidden className="mt-px">
                ⟲
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
