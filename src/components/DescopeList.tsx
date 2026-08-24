"use client";

import type { DescopeEvent } from "@/lib/linear/descope";
import { Tag } from "@/components/Tag";

const priorityTone: Record<string, string> = {
  Urgent: "bg-rose-100 text-rose-700 ring-rose-200",
  High: "bg-orange-50 text-orange-700 ring-orange-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low: "bg-slate-100 text-slate-500 ring-slate-200",
};

const statusTone: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 ring-slate-200",
  unstarted: "bg-slate-100 text-slate-600 ring-slate-200",
  started: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-400 ring-slate-200",
};

function movedAt(iso: string): string {
  // Fixed locale + UTC so server and client render the same string.
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Features that left one release's scope, as recorded in Linear.
 *
 * Rendered inside a run card, so it is deliberately narrow: ticket,
 * priority, title, where it went, current status, when it moved.
 */
export function DescopeList({
  release,
  events,
}: {
  release: string;
  events: DescopeEvent[];
}) {
  if (events.length === 0) {
    return (
      <p className="text-[13px] text-slate-500">
        No features left {release}&apos;s scope in Linear.
      </p>
    );
  }

  return (
    <div>
      <p className="font-display text-sm font-semibold text-slate-800">
        {events.length} feature{events.length === 1 ? "" : "s"} descoped from{" "}
        {release}
      </p>
      {/* Two lines per row on purpose: a run card column is ~340px, so a
          single-line layout truncated titles down to "[...". */}
      <ul className="mt-2 divide-y divide-hairline overflow-hidden rounded-lg bg-surface-card ring-1 ring-hairline">
        {events.map((event) => (
          <li key={event.id} className="px-3 py-2">
            <div className="flex items-baseline gap-2">
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-mono text-xs font-semibold text-brand-700 hover:underline"
              >
                {event.id}
              </a>
              <span
                className="min-w-0 flex-1 truncate text-[13px] text-slate-800"
                title={event.title}
              >
                {event.title}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {event.priorityName && (
                <Tag
                  className={
                    priorityTone[event.priorityName] ?? priorityTone.Low
                  }
                >
                  {event.priorityName}
                </Tag>
              )}
              <Tag
                className={statusTone[event.statusType] ?? statusTone.backlog}
              >
                {event.status}
              </Tag>
              <span
                className="text-xs text-slate-500"
                title={`Left ${release} on ${event.at}`}
              >
                →{" "}
                {event.toRelease
                  ? `${event.toRelease} Release`
                  : (event.toProject ?? "no project")}
              </span>
              <span className="nums text-xs text-slate-400">
                {movedAt(event.at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
