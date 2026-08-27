"use client";

import { useMemo } from "react";
import {
  DataRow,
  EmptyState,
  FilterBar,
  FilterGroup,
  Meta,
  Slot,
  Tag,
  TicketLink,
  type FilterOption,
} from "@/components/ui";
import {
  STATE_LABEL,
  type SignOffState,
  type SignOffStory,
} from "@/lib/sign-off";
import { useUrlFilter } from "@/lib/use-url-filter";

/**
 * The design gate, one row per story: did it reach dev, and was it
 * presented in writing.
 *
 * Rows are ordered worst first — a story merged with no written
 * confirmation is the only one needing action, so it leads. The filter
 * defaults to every state so the board opens as a full picture, and the
 * gap can be isolated in one click.
 */
const STATE_TONE: Record<SignOffState, string> = {
  "merged-unconfirmed": "bg-rose-50 text-rose-700 ring-rose-200",
  "confirmed-unmerged": "bg-sky-50 text-sky-700 ring-sky-200",
  "in-design": "bg-slate-100 text-slate-600 ring-slate-200",
  "signed-off": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "predates-sync": "bg-slate-100 text-slate-400 ring-slate-200",
};

const STATE_ORDER: SignOffState[] = [
  "merged-unconfirmed",
  "confirmed-unmerged",
  "in-design",
  "signed-off",
  "predates-sync",
];

const STORY_LABEL: Record<string, string> = {
  "Medium to Big Size Features": "Medium/Big",
  "Quick wins": "Quick win",
};

const STORY_LABEL_TONE: Record<string, string> = {
  "Medium to Big Size Features": "bg-violet-50 text-violet-700 ring-violet-200",
  "Quick wins": "bg-teal-50 text-teal-700 ring-teal-200",
};

function stamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function SignOffBoard({
  rows,
  channelName,
}: {
  rows: SignOffStory[];
  channelName: string;
}) {
  const states = useMemo(
    () => STATE_ORDER.filter((s) => rows.some((r) => r.state === s)),
    [rows],
  );
  const filter = useUrlFilter("gate", states);

  const options: FilterOption[] = useMemo(
    () =>
      states.map((state) => ({
        value: state,
        label: STATE_LABEL[state],
        count: rows.filter((r) => r.state === state).length,
      })),
    [states, rows],
  );

  const visible = useMemo(
    () => rows.filter((r) => filter.selected.has(r.state)),
    [rows, filter.selected],
  );

  if (rows.length === 0) {
    return (
      <EmptyState>
        No Medium/Big or Quick win stories found in this project.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterGroup
          label="Gate"
          options={options}
          selected={[...filter.selected]}
          onChange={filter.set}
          bulk
        />
      </FilterBar>

      <div className="overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline">
        <ul className="divide-y divide-hairline">
          {visible.map((row) => (
            <DataRow
              key={row.id}
              leading={<TicketLink id={row.id} url={row.url} />}
              slots={
                <Slot width={84}>
                  {row.labels
                    .filter((l) => STORY_LABEL[l])
                    .slice(0, 1)
                    .map((l) => (
                      <Tag key={l} className={STORY_LABEL_TONE[l]}>
                        {STORY_LABEL[l]}
                      </Tag>
                    ))}
                </Slot>
              }
              title={row.title}
              titleAttr={row.title}
              trailing={
                <>
                  <Tag className={STATE_TONE[row.state]} title={row.note}>
                    {STATE_LABEL[row.state]}
                  </Tag>
                  <Meta
                    width={104}
                    muted={!row.isMerged}
                    title={
                      row.isMerged
                        ? row.mergedAt
                          ? `First reached "Merged to dev" on ${new Date(row.mergedAt).toLocaleString()}`
                          : 'Currently "Merged to dev"; the change fell outside the history window'
                        : `Currently ${row.status}`
                    }
                  >
                    {row.isMerged
                      ? row.mergedAt
                        ? `merged ${stamp(row.mergedAt)}`
                        : "merged"
                      : row.status}
                  </Meta>
                  {/* The evidence itself, one click away — a gate you cannot
                      audit is a gate nobody trusts. */}
                  {row.slack ? (
                    <a
                      href={row.slack.url}
                      target="_blank"
                      rel="noreferrer"
                      title={row.slack.subtitle ?? row.slack.title}
                      className="shrink-0 text-[11px] font-medium text-brand-700 hover:underline"
                    >
                      Slack thread ↗
                    </a>
                  ) : (
                    <span
                      className="shrink-0 text-[11px] text-slate-400"
                      title={`No thread from #${channelName} is linked to this issue in Linear`}
                    >
                      no thread
                    </span>
                  )}
                </>
              }
            />
          ))}
        </ul>
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl bg-surface-card px-5 py-10 text-center text-[13px] text-slate-500 shadow-card ring-1 ring-hairline">
          No stories match this filter.
        </p>
      )}
    </div>
  );
}
