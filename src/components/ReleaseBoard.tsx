"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CoveredTicket,
  ReleaseGroup,
  RoadmapNode,
} from "@/lib/linear/types";
import { DescopeMark, DescopeProvider } from "@/components/DescopeMark";
import { byDescopedThenPriority } from "@/lib/roadmap-order";
import { loadRoadmapDescopes } from "@/lib/roadmap-actions";
import type { RoadmapDescopeMap } from "@/lib/roadmap-descopes";
import { useUrlFilter } from "@/lib/use-url-filter";
import {
  Chevron,
  FilterBar,
  FilterGroup,
  Tag,
  type FilterOption,
} from "@/components/ui";

/** Coverage boxes: both selected by default, either can stand alone. */
const COVERAGE_VALUES = ["has", "none"];

const statusTone: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 ring-slate-200",
  unstarted: "bg-slate-100 text-slate-600 ring-slate-200",
  started: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-400 ring-slate-200",
};

/** Linear priority labels, warmest first. */
const priorityTone: Record<string, string> = {
  Urgent: "bg-rose-100 text-rose-700 ring-rose-200",
  High: "bg-orange-50 text-orange-700 ring-orange-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low: "bg-slate-100 text-slate-500 ring-slate-200",
};

/** A board row after filtering: the node plus the sub-issues still shown. */
interface VisibleNode {
  node: RoadmapNode;
  children: CoveredTicket[];
  /** True when the parent row is only there to hold matching sub-issues. */
  containerOnly: boolean;
}

interface VisibleGroup extends ReleaseGroup {
  rows: VisibleNode[];
  counted: number;
  covered: number;
}

function CoverageTag({ ticket }: { ticket: CoveredTicket }) {
  if (ticket.hasTestCases) {
    return (
      <Tag tone="success">
        <span className="nums">✓ {ticket.caseCount}</span>
        <span className="ml-1 font-medium">
          test case{ticket.caseCount === 1 ? "" : "s"}
        </span>
      </Tag>
    );
  }
  return <Tag tone="danger">No test cases</Tag>;
}

function TicketLink({ ticket }: { ticket: CoveredTicket }) {
  return (
    <a
      href={ticket.url}
      target="_blank"
      rel="noreferrer"
      className="w-[68px] shrink-0 font-mono text-[11px] font-semibold text-brand-700 hover:underline"
    >
      {ticket.id}
    </a>
  );
}

/**
 * Linear priority, in a fixed-width slot right of the ticket id so the
 * ids, priorities and titles read as columns even when untriaged tickets
 * have no priority at all.
 */
function PriorityTag({ ticket }: { ticket: CoveredTicket }) {
  const priority = ticket.priorityName;
  if (!priority) {
    return (
      <span
        className="w-[70px] shrink-0 text-center text-[11px] text-slate-300"
        title="No priority set in Linear"
      >
        —
      </span>
    );
  }
  return (
    <span className="w-[70px] shrink-0">
      <Tag className={priorityTone[priority] ?? priorityTone.Low}>
        {priority}
      </Tag>
    </span>
  );
}

function FolderHint({ ticket }: { ticket: CoveredTicket }) {
  if (ticket.folders.length === 0) return null;
  return (
    <span
      className="text-[11px] text-slate-400"
      title={`Testiny folders: ${ticket.folders.join(", ")}`}
    >
      {ticket.folders.length} folder{ticket.folders.length === 1 ? "" : "s"}
    </span>
  );
}

function TicketRow({
  ticket,
  nested = false,
}: {
  ticket: CoveredTicket;
  nested?: boolean;
}) {
  return (
    <li
      className={
        nested
          ? "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 border-brand-100 py-2 pr-4 pl-3 transition-colors hover:bg-white"
          : "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-sunken"
      }
    >
      <TicketLink ticket={ticket} />
      <PriorityTag ticket={ticket} />
      <span
        className="min-w-0 flex-1 truncate text-[13px] text-slate-800"
        title={ticket.title}
      >
        {ticket.title}
      </span>
      <Tag className={statusTone[ticket.statusType] ?? statusTone.backlog}>
        {ticket.status}
      </Tag>
      <DescopeMark id={ticket.id} />
      <CoverageTag ticket={ticket} />
      <FolderHint ticket={ticket} />
    </li>
  );
}

/** A parent issue: click the row to reveal its sub-issues, indented. */
function ParentRow({
  row,
  startOpen,
}: {
  row: VisibleNode;
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const { node, children, containerOnly } = row;
  const { ticket } = node;
  const covered = children.filter((c) => c.hasTestCases).length;

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-surface-sunken">
        <TicketLink ticket={ticket} />
        <PriorityTag ticket={ticket} />
        <DescopeMark id={ticket.id} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 text-left"
        >
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800"
            title={ticket.title}
          >
            {ticket.title}
          </span>
          <Tag className={statusTone[ticket.statusType] ?? statusTone.backlog}>
            {ticket.status}
          </Tag>
          {containerOnly ? (
            <Tag className="bg-slate-100 text-slate-500 ring-slate-200">
              Parent issue
            </Tag>
          ) : (
            <CoverageTag ticket={ticket} />
          )}
          {!containerOnly && <FolderHint ticket={ticket} />}
          <span className="text-[11px] whitespace-nowrap text-slate-500">
            {children.length} sub-issue{children.length === 1 ? "" : "s"} ·{" "}
            {covered} with test cases
          </span>
          <Chevron open={open} />
        </button>
      </div>
      {open && (
        <ul className="divide-y divide-hairline border-t border-hairline bg-surface-sunken pl-6">
          {children.map((child) => (
            <TicketRow key={child.id} ticket={child} nested />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Slim coverage meter shown on each release group header. */
function CoverageMeter({
  covered,
  counted,
}: {
  covered: number;
  counted: number;
}) {
  const pct = counted > 0 ? Math.round((covered / counted) * 100) : 0;
  return (
    <span className="flex items-center gap-2">
      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 sm:block">
        <span
          className="block h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="nums text-[11px] text-slate-500">
        {covered}/{counted} with test cases
      </span>
    </span>
  );
}

function CollapsibleReleaseGroup({
  group,
  expandParents,
}: {
  group: VisibleGroup;
  /** Open parent rows on mount — used while a coverage filter narrows. */
  expandParents: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken"
      >
        <h2 className="font-display flex items-center gap-2 text-sm font-semibold text-slate-800">
          {group.isRelease && (
            <span aria-hidden className="size-1.5 rounded-full bg-brand-600" />
          )}
          {group.name}
        </h2>
        <span className="flex items-center gap-3">
          <CoverageMeter covered={group.covered} counted={group.counted} />
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {group.rows.map((row) =>
            row.children.length > 0 ? (
              // Remounted per filter state so a narrowed view opens on its
              // matches rather than hiding them behind a collapsed row.
              <ParentRow
                key={`${row.node.ticket.id}:${expandParents}`}
                row={row}
                startOpen={expandParents}
              />
            ) : (
              <TicketRow key={row.node.ticket.id} ticket={row.node.ticket} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

export function ReleaseBoard({
  groups,
  defaultGroup,
  descopes,
  loadedGroups,
}: {
  groups: ReleaseGroup[];
  /**
   * Descope history per ticket id, for the groups loaded so far. Decides
   * both the tag and the order: anything pushed out of a release before
   * sorts to the top.
   */
  descopes?: RoadmapDescopeMap;
  /**
   * The groups that history covers. Others load when selected — reading
   * it for every roadmap project is the slowest call in the app, and the
   * board opens on one group.
   */
  loadedGroups?: string[];
  /**
   * The one group the board opens on. Everything else is a click away —
   * opening on every project buried the squad's own work under releases
   * nobody was looking at.
   */
  defaultGroup?: string;
}) {
  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);
  // Falls back to the full list when the named group is absent: a renamed
  // project should open the board on everything, never on nothing, because
  // an empty board reads as "no work" rather than as "bad config".
  const releaseDefaults = useMemo(
    () =>
      defaultGroup && groupNames.includes(defaultGroup)
        ? [defaultGroup]
        : groupNames,
    [defaultGroup, groupNames],
  );
  const release = useUrlFilter("release", groupNames, releaseDefaults);

  const [history, setHistory] = useState<RoadmapDescopeMap>(descopes ?? {});
  const [loadingGroups, setLoadingGroups] = useState<string[]>([]);
  // Requested, not just loaded: two renders can ask for the same group
  // before either returns, and fetching that history twice is the bug
  // that makes a slow board slower.
  const requested = useRef(new Set(loadedGroups ?? []));

  const coverage = useUrlFilter("coverage", COVERAGE_VALUES);
  // With one coverage box active the view is a hunt for those rows, so
  // parents open onto their matches instead of hiding them.
  const narrowed = coverage.selected.size === 1;

  const releaseOptions: FilterOption[] = useMemo(
    () =>
      groups.map((group) => {
        const name = group.name.replace(/ Release$/, "");
        return {
          value: group.name,
          // The tickets are already here; only the descope history is in
          // flight, so the group is usable and the label says what is
          // still arriving rather than blocking on it.
          label: loadingGroups.includes(group.name) ? `${name} …` : name,
          count: group.tickets.length,
        };
      }),
    [groups, loadingGroups],
  );

  const coverageOptions: FilterOption[] = useMemo(() => {
    const inScope = groups.filter((g) => release.selected.has(g.name));
    const tickets = inScope.flatMap((g) => g.tickets);
    return [
      {
        value: "has",
        label: "Has test cases",
        count: tickets.filter((t) => t.hasTestCases).length,
      },
      {
        value: "none",
        label: "No test cases",
        count: tickets.filter((t) => !t.hasTestCases).length,
      },
    ];
  }, [groups, release.selected]);

  const wasDescoped = useCallback(
    (id: string) => (history[id]?.length ?? 0) > 0,
    [history],
  );

  // Driven by the selection rather than by the click, so a filtered URL
  // pasted to a teammate loads the history for the groups it names.
  const selectedGroupKey = [...release.selected].sort().join("|");
  useEffect(() => {
    const wanted = selectedGroupKey
      .split("|")
      .filter((name) => name && !requested.current.has(name));
    if (wanted.length === 0) return;

    for (const name of wanted) requested.current.add(name);
    setLoadingGroups((current) => [...current, ...wanted]);

    void loadRoadmapDescopes(wanted)
      .then((more) => setHistory((current) => ({ ...current, ...more })))
      .catch(() => {
        // Forget it, so selecting the group again tries once more rather
        // than leaving those rows unmarked for the rest of the visit.
        for (const name of wanted) requested.current.delete(name);
      })
      .finally(() =>
        setLoadingGroups((current) =>
          current.filter((name) => !wanted.includes(name)),
        ),
      );
  }, [selectedGroupKey]);

  const visible = useMemo<VisibleGroup[]>(() => {
    const matches = (t: CoveredTicket) =>
      coverage.selected.has(t.hasTestCases ? "has" : "none");

    return groups
      .filter((group) => release.selected.has(group.name))
      .map((group) => {
        const rows: VisibleNode[] = [];
        let counted = 0;
        let covered = 0;

        for (const node of group.nodes) {
          const children = node.children.filter(matches);
          const selfShown = !node.contextOnly && matches(node.ticket);
          if (!selfShown && children.length === 0) continue;

          rows.push({ node, children, containerOnly: !selfShown });
          // Only rows passing the filter on their own merit are counted; a
          // parent kept just to hold matching sub-issues is not.
          const tallied = selfShown ? [node.ticket, ...children] : children;
          counted += tallied.length;
          covered += tallied.filter((t) => t.hasTestCases).length;
        }

        // Anything pushed out of a release before goes to the top, and
        // within that band the usual priority order applies. A ticket that
        // has already slipped once is the one most likely to slip again,
        // and on a flat list it was indistinguishable from work that has
        // never been scheduled.
        //
        // Stable beneath the band: rows keep the order buildRoadmapNodes
        // gave them — uncovered first, then priority, then id — so the
        // untouched part of the list reads exactly as it did before.
        const order = byDescopedThenPriority(wasDescoped);
        rows.sort((x, y) => order(x.node.ticket, y.node.ticket));

        return { ...group, rows, counted, covered };
      })
      .filter((group) => group.rows.length > 0);
  }, [groups, coverage.selected, release.selected, wasDescoped]);

  return (
    <DescopeProvider value={history}>
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
            label="Test cases"
            options={coverageOptions}
            selected={[...coverage.selected]}
            onChange={coverage.set}
            bulk
          />
        </FilterBar>

        <div className="mt-4 space-y-4">
          {visible.map((group) => (
            <CollapsibleReleaseGroup
              key={group.name}
              group={group}
              expandParents={narrowed}
            />
          ))}
          {visible.length === 0 && (
            <p className="rounded-xl bg-surface-card px-5 py-10 text-center text-[13px] text-slate-500 shadow-card ring-1 ring-hairline">
              {release.selected.size === 0 || coverage.selected.size === 0
                ? "Nothing selected — pick a release and a test-case state above."
                : "No tickets match these filters."}
            </p>
          )}
        </div>
      </div>
    </DescopeProvider>
  );
}
