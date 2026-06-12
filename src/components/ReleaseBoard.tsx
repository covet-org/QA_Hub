"use client";

import { useMemo, useState } from "react";
import type { CoveredTicket, ReleaseGroup } from "@/lib/linear/types";
import { Tag } from "@/components/Tag";

type CoverageFilter = "all" | "covered" | "missing";

const FILTERS: { value: CoverageFilter; label: string }[] = [
  { value: "all", label: "All tickets" },
  { value: "covered", label: "Has test cases" },
  { value: "missing", label: "No test cases" },
];

const statusTone: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 ring-slate-200",
  unstarted: "bg-slate-100 text-slate-600 ring-slate-200",
  started: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-400 ring-slate-200",
};

function CoverageTag({ ticket }: { ticket: CoveredTicket }) {
  if (ticket.hasTestCases) {
    return (
      <Tag className="bg-emerald-50 text-emerald-700 ring-emerald-200">
        ✓ {ticket.caseCount} test case{ticket.caseCount === 1 ? "" : "s"}
      </Tag>
    );
  }
  return (
    <Tag className="bg-rose-50 text-rose-700 ring-rose-200">No test cases</Tag>
  );
}

function TicketRow({ ticket }: { ticket: CoveredTicket }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white px-5 py-3.5">
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
      <Tag className={statusTone[ticket.statusType] ?? statusTone.backlog}>
        {ticket.status}
      </Tag>
      <CoverageTag ticket={ticket} />
      {ticket.folders.length > 0 && (
        <span
          className="text-xs text-slate-400"
          title={`Testiny folders: ${ticket.folders.join(", ")}`}
        >
          {ticket.folders.length} folder{ticket.folders.length === 1 ? "" : "s"}
        </span>
      )}
    </li>
  );
}

export function ReleaseBoard({ groups }: { groups: ReleaseGroup[] }) {
  const [filter, setFilter] = useState<CoverageFilter>("all");

  const visible = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          tickets: group.tickets.filter((t) =>
            filter === "all"
              ? true
              : filter === "covered"
                ? t.hasTestCases
                : !t.hasTestCases,
          ),
        }))
        .filter((group) => group.tickets.length > 0),
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
        {visible.map((group) => {
          const covered = group.tickets.filter((t) => t.hasTestCases).length;
          return (
            <section key={group.name}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-base font-semibold text-slate-800">
                  {group.name}
                </h2>
                <span className="text-xs text-slate-500">
                  {covered}/{group.tickets.length} with test cases
                </span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
                {group.tickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 && (
          <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            No tickets match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
