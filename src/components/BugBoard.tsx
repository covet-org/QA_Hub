"use client";

import { useMemo, useState } from "react";
import type { BugGroup } from "@/lib/bugs";
import type { RoadmapTicket } from "@/lib/linear/types";
import {
  FilterBar,
  MultiSelectFilter,
  type FilterOption,
} from "@/components/MultiSelectFilter";
import { Tag } from "@/components/Tag";
import { useUrlFilter } from "@/lib/use-url-filter";

const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low", "No priority"];

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Todo" },
  { value: "started", label: "In Progress" },
  { value: "completed", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

const OPEN_TYPES = ["backlog", "unstarted", "started"];

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
  "No priority": "bg-slate-100 text-slate-500 ring-slate-200",
};

const priorityDot: Record<string, string> = {
  Urgent: "bg-rose-500",
  High: "bg-amber-400",
  Medium: "bg-sky-500",
  Low: "bg-slate-400",
  "No priority": "bg-slate-300",
};

function priorityOf(t: RoadmapTicket): string {
  return t.priorityName ?? "No priority";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

/** Single-select pill row (release, status). */
function FilterPills<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { value: T; label: string }[];
  selected: T | "all";
  onSelect: (value: T | "all") => void;
}) {
  const all = [{ value: "all" as const, label: "All" }, ...options];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {title}
      </span>
      {all.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
            selected === option.value
              ? "bg-brand-800 text-white"
              : "bg-white text-slate-600 ring-1 ring-hairline hover:bg-slate-50"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select pill row for priorities. Empty selection = all. */
function PriorityPills({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<string>;
  onToggle: (p: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Priority
      </span>
      <button
        type="button"
        onClick={onClear}
        className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
          selected.size === 0
            ? "bg-brand-800 text-white"
            : "bg-white text-slate-600 ring-1 ring-hairline hover:bg-slate-50"
        }`}
      >
        All
      </button>
      {PRIORITY_ORDER.map((p) => {
        const on = selected.has(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              on
                ? "bg-brand-800 text-white"
                : "bg-white text-slate-600 ring-1 ring-hairline hover:bg-slate-50"
            }`}
          >
            <span className={`size-2 rounded-full ${priorityDot[p]}`} />
            {p}
          </button>
        );
      })}
    </div>
  );
}

function BugRow({ ticket }: { ticket: RoadmapTicket }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-sunken">
      <a
        href={ticket.url}
        target="_blank"
        rel="noreferrer"
        className="w-[68px] shrink-0 font-mono text-[11px] font-semibold text-brand-700 hover:underline"
      >
        {ticket.id}
      </a>
      <span
        className="min-w-0 flex-1 truncate text-[13px] text-slate-800"
        title={ticket.title}
      >
        {ticket.title}
      </span>
      {ticket.priorityName && (
        <Tag className={priorityTone[ticket.priorityName] ?? priorityTone.Low}>
          {ticket.priorityName}
        </Tag>
      )}
      {/* Assignee from Linear — who actually owns fixing this bug. */}
      {ticket.assigneeName ? (
        <span
          className="w-[104px] shrink-0 truncate text-right text-[11px] text-slate-500"
          title={`Assigned to ${ticket.assigneeName} in Linear`}
        >
          {ticket.assigneeName}
        </span>
      ) : (
        <span
          className="w-[104px] shrink-0 text-right text-[11px] text-slate-300"
          title="Unassigned in Linear"
        >
          unassigned
        </span>
      )}
      <Tag className={statusTone[ticket.statusType] ?? statusTone.backlog}>
        {ticket.status}
      </Tag>
    </li>
  );
}

function CollapsibleGroup({
  group,
  defaultOpen,
}: {
  group: BugGroup;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken"
      >
        <span className="flex items-baseline gap-2.5">
          <h2 className="font-display text-sm font-semibold text-slate-800">
            {group.name}
          </h2>
          <span className="nums text-[11px] text-slate-400">
            {group.openCount} open · {group.tickets.length} total
          </span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {group.tickets.map((ticket) => (
            <BugRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function BugBoard({ groups }: { groups: BugGroup[] }) {
  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);
  const release = useUrlFilter("release", groupNames);
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | "all">("all");

  const releaseOptions: FilterOption[] = useMemo(
    () =>
      groups.map((group) => ({
        value: group.name,
        label: group.name.replace(/ Release$/, ""),
        count: group.tickets.length,
      })),
    [groups],
  );

  const filtering = priorities.size > 0 || status !== "all";

  function togglePriority(p: string) {
    setPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  /** Release groups filtered by the current release/status and an
   *  optional single priority (null = all priorities). */
  function buildGroups(priorityFilter: string | null): BugGroup[] {
    return groups
      .filter((g) => release.selected.has(g.name))
      .map((g) => {
        const tickets = g.tickets.filter((t) => {
          if (priorityFilter && priorityOf(t) !== priorityFilter) return false;
          if (status !== "all" && t.statusType !== status) return false;
          return true;
        });
        return {
          ...g,
          tickets,
          openCount: tickets.filter((t) => OPEN_TYPES.includes(t.statusType))
            .length,
        };
      })
      .filter((g) => g.tickets.length > 0 || (g.isRelease && !filtering));
  }

  const selectedPriorities = PRIORITY_ORDER.filter((p) => priorities.has(p));
  const sig = `${[...release.selected].sort().join("|")}-${status}-${[...priorities].sort().join(",")}`;

  return (
    <div>
      <FilterBar>
        <MultiSelectFilter
          label="Release"
          options={releaseOptions}
          selected={release.selected}
          onToggle={release.toggle}
          onAll={release.setAll}
          onClear={release.clear}
        />
        <PriorityPills
          selected={priorities}
          onToggle={togglePriority}
          onClear={() => setPriorities(new Set())}
        />
        <FilterPills
          title="Status"
          options={STATUS_FILTERS}
          selected={status}
          onSelect={setStatus}
        />
      </FilterBar>

      {selectedPriorities.length >= 2 ? (
        // Multiple priorities → one box per priority.
        <div className="mt-5 space-y-6">
          {selectedPriorities.map((p) => {
            const pGroups = buildGroups(p);
            const total = pGroups.reduce((n, g) => n + g.tickets.length, 0);
            return (
              <section
                key={p}
                className="overflow-hidden rounded-xl ring-1 ring-hairline"
              >
                <div
                  className={`flex items-center gap-2 px-5 py-3 ring-1 ring-inset ${
                    priorityTone[p] ?? priorityTone.Low
                  }`}
                >
                  <span className={`size-2.5 rounded-full ${priorityDot[p]}`} />
                  <h3 className="font-display text-[13px] font-semibold">{p}</h3>
                  <span className="text-[11px] opacity-70">{total} bugs</span>
                </div>
                <div className="space-y-3 bg-slate-50/50 p-3">
                  {pGroups.map((group) => (
                    <CollapsibleGroup
                      key={`${p}-${group.name}-${sig}`}
                      group={group}
                      defaultOpen
                    />
                  ))}
                  {pGroups.length === 0 && (
                    <p className="px-2 py-6 text-center text-[13px] text-slate-500">
                      No {p.toLowerCase()} bugs in this view.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        // No priority filter, or a single one → one release-grouped board.
        (() => {
          const board = buildGroups(selectedPriorities[0] ?? null);
          return (
            <div className="mt-5 space-y-4">
              {board.map((group, index) => (
                <CollapsibleGroup
                  key={`${group.name}-${sig}`}
                  group={group}
                  defaultOpen={filtering || index === 0}
                />
              ))}
              {board.length === 0 && (
                <p className="rounded-xl bg-surface-card px-5 py-10 text-center text-[13px] text-slate-500 ring-1 ring-hairline">
                  No bugs match these filters.
                </p>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
