"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RunCard } from "@/components/RunCard";
import { loadReleaseBoardData } from "@/lib/release-actions";
import type { ReleaseTimeline } from "@/lib/release-timeline";
import type { RunSummary } from "@/lib/testiny/types";
import { useUrlFilter } from "@/lib/use-url-filter";
import { FilterBar, FilterGroup, type FilterOption } from "@/components/ui";

/** Runs are named "Regression 3.36", "3.36 Dev/Sandbox", etc. */
const versionOf = (title: string): string =>
  title.match(/(\d+\.\d+)/)?.[1] ?? "Other";

/**
 * The releases board, loaded a release at a time.
 *
 * The server sends the newest release and the names of the rest. Picking
 * another release in the filter fetches it — reading its runs' case
 * results and its project's issue history — and it stays loaded for the
 * rest of the visit.
 *
 * Every release is in the filter from the start, loaded or not. Hiding the
 * ones without data would make the board look like it had lost them, and
 * the whole point is that a viewer chooses what is worth waiting for.
 */
export function RunsBoard({
  state,
  initialRuns,
  initialTimelines,
  allReleases,
  loadedReleases,
  emptyLabel,
}: {
  state: "active" | "closed";
  initialRuns: RunSummary[];
  initialTimelines: Record<string, ReleaseTimeline>;
  /** Every release with a run in this state, newest first. */
  allReleases: string[];
  /** The ones the server already sent. */
  loadedReleases: string[];
  emptyLabel: string;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [timelines, setTimelines] = useState(initialTimelines);
  const [loaded, setLoaded] = useState(() => new Set(loadedReleases));
  const [loading, setLoading] = useState<string[]>([]);
  // Requested, not just loaded: two renders can ask for the same release
  // before either returns, and fetching it twice is the bug that makes a
  // slow board slower.
  const requested = useRef(new Set(loadedReleases));

  const versions = useMemo(
    () => (allReleases.length > 0 ? allReleases : ["Other"]),
    [allReleases],
  );
  const release = useUrlFilter("release", versions, loadedReleases);

  const fetchReleases = useCallback(
    async (wanted: string[]) => {
      const fresh = wanted.filter((r) => !requested.current.has(r));
      if (fresh.length === 0) return;
      for (const r of fresh) requested.current.add(r);
      setLoading((current) => [...current, ...fresh]);

      try {
        const data = await loadReleaseBoardData(state, fresh);
        setRuns((current) => [...current, ...data.runs]);
        setTimelines((current) => ({ ...current, ...data.timelines }));
        setLoaded((current) => new Set([...current, ...fresh]));
      } catch {
        // Let it be asked for again rather than leaving the release stuck
        // on "loading" for the rest of the visit.
        for (const r of fresh) requested.current.delete(r);
      } finally {
        setLoading((current) => current.filter((r) => !fresh.includes(r)));
      }
    },
    [state],
  );

  // Driven by the selection rather than by the click, so a filtered URL
  // pasted to a teammate loads the same releases it names.
  const selectedKey = [...release.selected].sort().join("|");
  useEffect(() => {
    const wanted = selectedKey.split("|").filter(Boolean);
    void fetchReleases(wanted);
  }, [selectedKey, fetchReleases]);

  const options: FilterOption[] = useMemo(
    () =>
      versions.map((version) => ({
        value: version,
        label: loading.includes(version) ? `${version} …` : version,
        count: loaded.has(version)
          ? runs.filter((r) => versionOf(r.title) === version).length
          : undefined,
      })),
    [versions, runs, loaded, loading],
  );

  const visible = useMemo(
    () => runs.filter((run) => release.selected.has(versionOf(run.title))),
    [runs, release.selected],
  );

  if (allReleases.length === 0) {
    return <p className="text-[13px] text-slate-500">{emptyLabel}</p>;
  }

  const pending = loading.length > 0;

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterGroup
          label="Release"
          options={options}
          selected={[...release.selected]}
          onChange={release.set}
          bulk
        />
      </FilterBar>

      {/* Full-width panels stacked like the roadmap's release groups: a
          run expands across the screen instead of inside a narrow column,
          and nothing stretches a neighbour. */}
      <div className="space-y-4">
        {visible.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            releaseNumber={
              versionOf(run.title) === "Other"
                ? undefined
                : versionOf(run.title)
            }
            timeline={timelines[versionOf(run.title)]}
          />
        ))}
      </div>

      {pending && (
        <p
          role="status"
          className="rounded-xl bg-surface-card px-5 py-6 text-center text-[13px] text-slate-500 shadow-card ring-1 ring-hairline"
        >
          Loading {loading.join(", ")}…
        </p>
      )}

      {!pending && visible.length === 0 && (
        <p className="rounded-xl bg-surface-card px-5 py-10 text-center text-[13px] text-slate-500 shadow-card ring-1 ring-hairline">
          No runs match this filter.
        </p>
      )}
    </div>
  );
}
