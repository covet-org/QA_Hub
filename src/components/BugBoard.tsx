"use client";

import { useMemo, useState } from "react";
import type { BugGroup } from "@/lib/bugs";
import type { RoadmapTicket } from "@/lib/linear/types";
import { Tag } from "@/components/Tag";

type ReleaseFilter = "active" | "closed";

const FILTERS: { value: ReleaseFilter; label: string }[] = [
  { value: "active", label: "Active releases" },
  { value: "closed", label: "Closed releases" },
];

const statusTone: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 ring-slate-200",
  unstarted: "bg-slate-100 text-slate-600 ring-slate-200",
  started: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-400 ring-slate-200",
};

const priorityTone: Record<string, string> = {
  Urgent: "bg-rose-50 text-rose-700 ring-rose-200",
  High: "bg-amber-50 text-amber-700 ring-amber-200",
  Medium: "bg-sky-50 text-sky-700 ring-sky-200",
  Low: "bg-slate-100 text-slate-600 ring-slate-200",
};

function BugRow({ ticket }: { ticket: RoadmapTicket }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white px-5 py-3">
      <a
        href={ticket.url}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-xs font-semibold text-brand-700 hover:underline"
      >
        {ticket.id}
      </a>
      <span
        className="min-w-0 flex-1 truncate text-sm text-slate-800"
        title={ticket.title}
      >
        {ticket.title}
      </span>
      {ticket.priorityName && (
        <Tag className={priorityTone[ticket.priorityName] ?? priorityTone.Low}>
          {ticket.priorityName}
        </Tag>
      )}
      <Tag className={statusTone[ticket.statusType] ?? statusTone.backlog}>
        {ticket.status}
      </Tag>
    </li>
  );
}

export function BugBoard({ groups }: { groups: BugGroup[] }) {
  const [filter, setFilter] = useState<ReleaseFilter>("active");

  const visible = useMemo(
    () =>
      groups.filter((g) =>
        filter === "active" ? g.isActiveRelease : g.isRelease && !g.isActiveRelease,
      ),
    [groups, filter],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-brand-800 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {visible.map((group) => (
          <section key={group.name}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-base font-semibold text-slate-800">
                {group.name}
              </h2>
              <span className="text-xs text-slate-500">
                {group.openCount} open / {group.tickets.length} total
              </span>
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
              {group.tickets.map((ticket) => (
                <BugRow key={ticket.id} ticket={ticket} />
              ))}
            </ul>
          </section>
        ))}
        {visible.length === 0 && (
          <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            No bugs in {filter === "active" ? "active" : "closed"} releases.
          </p>
        )}
      </div>
    </div>
  );
}
