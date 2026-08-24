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
  // Fixed locale + UTC so the server and client render the same string.
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function DescopeRow({ event }: { event: DescopeEvent }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-sunken">
      <a
        href={event.url}
        target="_blank"
        rel="noreferrer"
        className="w-[68px] shrink-0 font-mono text-xs font-semibold text-brand-700 hover:underline"
      >
        {event.id}
      </a>
      <span className="w-[70px] shrink-0">
        {event.priorityName ? (
          <Tag
            className={priorityTone[event.priorityName] ?? priorityTone.Low}
          >
            {event.priorityName}
          </Tag>
        ) : (
          <span className="block text-center text-xs text-slate-300">—</span>
        )}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-sm text-slate-800"
        title={event.title}
      >
        {event.title}
      </span>
      <span
        className="shrink-0 text-xs text-slate-500"
        title={`Moved out of ${event.fromRelease} on ${event.at}`}
      >
        →{" "}
        {event.toRelease
          ? `${event.toRelease} Release`
          : (event.toProject ?? "no project")}
      </span>
      <Tag className={statusTone[event.statusType] ?? statusTone.backlog}>
        {event.status}
      </Tag>
      <span className="nums w-[52px] shrink-0 text-right text-xs text-slate-400">
        {movedAt(event.at)}
      </span>
    </li>
  );
}

/**
 * Features that left a release's scope, grouped by the release they left.
 *
 * A feature descoped from two releases appears under each of them — that
 * is the point, since both releases shipped without it — but never twice
 * within one release, so narrowing the release filter never duplicates a
 * row.
 */
export function DescopeBoard({
  byRelease,
  versions,
  unavailable,
  error,
}: {
  byRelease: Record<string, DescopeEvent[]>;
  /** Release versions in scope, already filtered by the page's chips. */
  versions: string[];
  unavailable: boolean;
  error: string | null;
}) {
  if (unavailable) return null;

  const groups = versions
    .map((version) => ({ version, events: byRelease[version] ?? [] }))
    .filter((group) => group.events.length > 0);

  const total = groups.reduce((n, g) => n + g.events.length, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[15px] font-semibold text-slate-800">
          Descoped features
        </h2>
        <p className="text-xs text-slate-500">
          Features that left a release&apos;s scope — pushed out when a happy
          path failed or an urgent bug could not be fixed in time.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Descope history unavailable.</span>{" "}
          Linear rejected the history query ({error}). Runs above are
          unaffected.
        </p>
      )}

      {!error && total === 0 && (
        <p className="rounded-xl bg-surface-card px-5 py-8 text-center text-sm text-slate-500 shadow-card ring-1 ring-hairline">
          No descopes detected for the selected releases.
        </p>
      )}

      {groups.map((group) => (
        <div
          key={group.version}
          className="overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <h3 className="font-display flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <span aria-hidden className="size-1.5 rounded-full bg-rose-500" />
              {group.version} Release
            </h3>
            <span className="nums text-xs text-slate-500">
              {group.events.length} feature
              {group.events.length === 1 ? "" : "s"} descoped
            </span>
          </div>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {group.events.map((event) => (
              <DescopeRow key={`${event.fromRelease}-${event.id}`} event={event} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
