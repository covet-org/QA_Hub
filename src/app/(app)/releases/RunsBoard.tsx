"use client";

import { useMemo } from "react";
import {
  FilterBar,
  MultiSelectFilter,
  type FilterOption,
} from "@/components/MultiSelectFilter";
import { RunCard } from "@/components/RunCard";
import type { RunSummary } from "@/lib/testiny/types";
import { useUrlFilter } from "@/lib/use-url-filter";

/** Runs are named "Regression 3.36", "3.36 Dev/Sandbox", etc. */
const versionOf = (title: string): string =>
  title.match(/(\d+\.\d+)/)?.[1] ?? "Other";

/** Newest release first; "Other" last. */
function byVersionDesc(a: string, b: string): number {
  if (a === "Other") return 1;
  if (b === "Other") return -1;
  return Number(b) - Number(a);
}

export function RunsBoard({
  runs,
  emptyLabel,
}: {
  runs: RunSummary[];
  emptyLabel: string;
}) {
  const versions = useMemo(
    () => [...new Set(runs.map((r) => versionOf(r.title)))].sort(byVersionDesc),
    [runs],
  );
  const release = useUrlFilter("release", versions);

  const options: FilterOption[] = useMemo(
    () =>
      versions.map((version) => ({
        value: version,
        label: version,
        count: runs.filter((r) => versionOf(r.title) === version).length,
      })),
    [versions, runs],
  );

  const visible = useMemo(
    () => runs.filter((run) => release.selected.has(versionOf(run.title))),
    [runs, release.selected],
  );

  if (runs.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <MultiSelectFilter
          label="Release"
          options={options}
          selected={release.selected}
          onToggle={release.toggle}
          onAll={release.setAll}
          onClear={release.clear}
        />
      </FilterBar>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            releaseNumber={versionOf(run.title) === "Other" ? undefined : versionOf(run.title)}
          />
        ))}
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl bg-surface-card px-5 py-10 text-center text-sm text-slate-500 shadow-card ring-1 ring-hairline">
          No runs match this filter.
        </p>
      )}
    </div>
  );
}
