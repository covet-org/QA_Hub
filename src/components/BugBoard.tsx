"use client";

import { useMemo, useState } from "react";
import type { BugGroup } from "@/lib/bugs";
import type { RoadmapTicket } from "@/lib/linear/types";
import { useUrlFilter } from "@/lib/use-url-filter";
import {
  DataRow,
  Disclosure,
  FilterBar,
  FilterGroup,
  Meta,
  Slot,
  Tag,
  TicketLink,
  type FilterOption,
} from "@/components/ui";

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

function BugRow({ ticket }: { ticket: RoadmapTicket }) {
  return (
    <DataRow
      leading={<TicketLink id={ticket.id} url={ticket.url} />}
      slots={
        <Slot>
          {ticket.priorityName && (
            <Tag
              className={priorityTone[ticket.priorityName] ?? priorityTone.Low}
            >
              {ticket.priorityName}
            </Tag>
          )}
        </Slot>
      }
      title={ticket.title}
      titleAttr={ticket.title}
      trailing={
        <>
          {/* Assignee from Linear — who actually owns fixing this bug. */}
          <Meta
            width={104}
            muted={!ticket.assigneeName}
            title={
              ticket.assigneeName
                ? `Assigned to ${ticket.assigneeName} in Linear`
                : "Unassigned in Linear"
            }
          >
            {ticket.assigneeName ?? "unassigned"}
          </Meta>
          <Tag className={statusTone[ticket.statusType] ?? statusTone.backlog}>
            {ticket.status}
          </Tag>
        </>
      }
    />
  );
}

function CollapsibleGroup({
  group,
  defaultOpen,
}: {
  group: BugGroup;
  defaultOpen: boolean;
}) {
  return (
    <Disclosure
      title={group.name}
      defaultOpen={defaultOpen}
      summary={
        <span className="nums text-[11px] text-slate-400">
          {group.openCount} open · {group.tickets.length} total
        </span>
      }
    >
      <ul className="divide-y divide-hairline">
        {group.tickets.map((ticket) => (
          <BugRow key={ticket.id} ticket={ticket} />
        ))}
      </ul>
    </Disclosure>
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
        <FilterGroup
          label="Release"
          options={releaseOptions}
          selected={[...release.selected]}
          onChange={release.set}
          bulk
        />
        <FilterGroup
          label="Priority"
          options={PRIORITY_ORDER.map((p) => ({
            value: p,
            label: p,
            dotClass: priorityDot[p],
          }))}
          selected={[...priorities]}
          onChange={(next) => setPriorities(new Set(next))}
          emptyMeans="all"
          allLabel="All"
        />
        <FilterGroup
          label="Status"
          options={STATUS_FILTERS.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
          selected={status === "all" ? [] : [status]}
          onChange={(next) => setStatus(next[0] ?? "all")}
          mode="single"
          emptyMeans="all"
          allLabel="All"
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
                  <h3 className="font-display text-[13px] font-semibold">
                    {p}
                  </h3>
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
