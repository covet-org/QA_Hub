"use client";

import { useState } from "react";
import { DescopeList } from "@/components/DescopeList";
import { fetchDescopes } from "@/lib/descope-cache";
import { loadReleaseContent, type DescopeResult } from "@/lib/release-actions";
import type { ReleaseBug, ReleaseContent } from "@/lib/release-content";
import type { CaseRef, RunSummary } from "@/lib/testiny/types";
import {
  RunProgressBar,
  RunProgressLegend,
  Tag,
} from "@/components/ui";

const STORY_LABEL: Record<string, string> = {
  "Medium to Big Size Features": "Medium/Big",
  "Quick wins": "Quick win",
};

const STORY_LABEL_TONE: Record<string, string> = {
  "Medium to Big Size Features": "bg-violet-50 text-violet-700 ring-violet-200",
  "Quick wins": "bg-teal-50 text-teal-700 ring-teal-200",
};

const PRIORITY_BUCKETS = ["Urgent", "High", "Medium", "Low", "No priority"];

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

function TicketLink({ id, url }: { id: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 font-mono text-[11px] font-semibold text-brand-700 hover:underline"
    >
      {id}
    </a>
  );
}

const STATUS_TYPE_RANK: Record<string, number> = {
  triage: 0,
  backlog: 1,
  unstarted: 2,
  started: 3,
  completed: 4,
  canceled: 5,
};

function BugRow({ bug }: { bug: ReleaseBug }) {
  return (
    <li className="flex items-baseline gap-2 py-0.5">
      <TicketLink id={bug.id} url={bug.url} />
      <span
        className="min-w-0 flex-1 truncate text-[13px] text-slate-700"
        title={bug.title}
      >
        {bug.title}
      </span>
    </li>
  );
}

/** Bugs grouped by priority, then by workflow status within each priority. */
function PriorityStatusBugs({ bugs }: { bugs: ReleaseBug[] }) {
  const groups = PRIORITY_BUCKETS.map((priority) => {
    const inPriority = bugs.filter(
      (b) => (b.priorityName ?? "No priority") === priority,
    );
    if (inPriority.length === 0) return null;

    const typeByStatus = new Map<string, string>();
    for (const b of inPriority) {
      if (!typeByStatus.has(b.status)) typeByStatus.set(b.status, b.statusType);
    }
    const statuses = [...typeByStatus.keys()]
      .sort(
        (a, b) =>
          (STATUS_TYPE_RANK[typeByStatus.get(a)!] ?? 9) -
            (STATUS_TYPE_RANK[typeByStatus.get(b)!] ?? 9) || a.localeCompare(b),
      )
      .map((name) => ({
        name,
        bugs: inPriority.filter((b) => b.status === name),
      }));
    return { priority, count: inPriority.length, statuses };
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  return (
    <div className="space-y-2.5">
      {groups.map(({ priority, count, statuses }) => (
        <div key={priority}>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${priorityTone[priority]}`}
          >
            <span className={`size-2 rounded-full ${priorityDot[priority]}`} />
            {priority} bugs ({count})
          </span>
          <div className="mt-1 space-y-1.5 pl-3">
            {statuses.map((s) => (
              <div key={s.name}>
                <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                  {s.name} ({s.bugs.length})
                </p>
                <ul className="mt-0.5 pl-2">
                  {s.bugs.map((b) => (
                    <BugRow key={b.id} bug={b} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReleaseDetail({
  releaseNumber,
  content,
}: {
  releaseNumber: string;
  content: ReleaseContent;
}) {
  // Nest bugs under their parent user story; the rest go to "Other bugs".
  const storyIds = new Set(content.stories.map((s) => s.id));
  const bugsByStory = new Map<string, ReleaseBug[]>();
  const orphanBugs: ReleaseBug[] = [];
  for (const bug of content.bugs) {
    if (bug.parentId && storyIds.has(bug.parentId)) {
      bugsByStory.set(bug.parentId, [
        ...(bugsByStory.get(bug.parentId) ?? []),
        bug,
      ]);
    } else {
      orphanBugs.push(bug);
    }
  }

  return (
    <div className="space-y-3 border-t border-hairline bg-surface-sunken px-4 py-3">
      <p className="font-display text-[13px] font-semibold text-slate-800">
        Release {releaseNumber}
      </p>

      {content.stories.map((story) => {
        const storyBugs = bugsByStory.get(story.id) ?? [];
        return (
          <div
            key={story.id}
            className="overflow-hidden rounded-lg bg-surface-card ring-1 ring-hairline"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
              <TicketLink id={story.id} url={story.url} />
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800"
                title={story.title}
              >
                {story.title}
              </span>
              {story.labels
                .filter((l) => STORY_LABEL[l])
                .map((l) => (
                  <Tag key={l} className={STORY_LABEL_TONE[l]}>
                    {STORY_LABEL[l]}
                  </Tag>
                ))}
              <span className="text-[11px] text-slate-400">
                {storyBugs.length} bug{storyBugs.length === 1 ? "" : "s"}
              </span>
            </div>
            {storyBugs.length > 0 && (
              <div className="px-3 py-2.5">
                <PriorityStatusBugs bugs={storyBugs} />
              </div>
            )}
          </div>
        );
      })}

      {orphanBugs.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-surface-card ring-1 ring-hairline">
          <div className="border-b border-hairline px-3 py-2 text-[13px] font-medium text-slate-700">
            Other bugs — not linked to a user story ({orphanBugs.length})
          </div>
          <div className="px-3 py-2.5">
            <PriorityStatusBugs bugs={orphanBugs} />
          </div>
        </div>
      )}

      {content.stories.length === 0 && orphanBugs.length === 0 && (
        <p className="text-[13px] text-slate-500">
          No roadmap tickets or bugs for this release.
        </p>
      )}
    </div>
  );
}

// The bar and legend live in the library so Home's progression card and
// this card cannot disagree about one run's progress.

function CaseList({
  label,
  dotClass,
  cases,
}: {
  label: string;
  dotClass: string;
  cases: CaseRef[];
}) {
  if (cases.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        <span className={`size-2 rounded-full ${dotClass}`} />
        {label} ({cases.length})
      </p>
      <ul className="mt-1.5 space-y-1">
        {cases.map((tc) => (
          <li key={tc.id} className="flex items-baseline gap-2.5 text-[13px]">
            <a
              href={tc.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-semibold text-brand-700 hover:underline"
            >
              TC-{tc.id}
            </a>
            <span
              className="min-w-0 flex-1 truncate text-slate-800"
              title={tc.title}
            >
              {tc.title}
            </span>
            {/* Assigned to, from Testiny's per-run assignment. */}
            {tc.assignee ? (
              <span
                className="shrink-0 text-[11px] text-slate-500"
                title={`Assigned to ${tc.assignee} in Testiny`}
              >
                {tc.assignee}
              </span>
            ) : (
              <span
                className="shrink-0 text-[11px] text-slate-300"
                title="Unassigned in Testiny"
              >
                unassigned
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Test-run card with a stacked result bar, fed by Testiny. */
export function RunCard({
  run,
  releaseNumber,
}: {
  run: RunSummary;
  releaseNumber?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  // Release stories/bugs are fetched on first expand, not with the page.
  const [releaseContent, setReleaseContent] = useState<ReleaseContent | null>(
    null,
  );
  const [releaseState, setReleaseState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  // Descopes come from Linear issue history, loaded on open for the same
  // reason as the release content: it is an expensive query.
  const [showDescopes, setShowDescopes] = useState(false);
  const [descopes, setDescopes] = useState<DescopeResult | null>(null);
  const [descopeState, setDescopeState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const executed = run.total - run.notRun;
  const progress = run.total > 0 ? Math.round((executed / run.total) * 100) : 0;
  const problemCount =
    (run.failedCases?.length ?? 0) +
    (run.blockedCases?.length ?? 0) +
    (run.skippedCases?.length ?? 0);
  const hasRelease = !!releaseNumber;

  async function toggleRelease() {
    const next = !showRelease;
    setShowRelease(next);
    if (!next || releaseContent || releaseState === "loading") return;
    setReleaseState("loading");
    try {
      setReleaseContent(await loadReleaseContent(releaseNumber!));
      setReleaseState("idle");
    } catch {
      setReleaseState("error");
    }
  }

  async function toggleDescopes() {
    const next = !showDescopes;
    setShowDescopes(next);
    if (!next || descopes || descopeState === "loading") return;
    setDescopeState("loading");
    try {
      // Shared per release, so the dev and regression cards of one
      // release do not each fetch the same list.
      setDescopes(await fetchDescopes(releaseNumber!));
      setDescopeState("idle");
    } catch {
      setDescopeState("error");
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline transition-shadow hover:shadow-card-hover">
      {/* Full-width header: run identity left, progress figure right. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h3 className="font-display min-w-0 truncate text-sm leading-tight font-semibold text-slate-800">
            {run.title}
          </h3>
          <Tag tone={run.isClosed ? "neutral" : "success"}>
            {run.isClosed ? "Closed" : "Active"}
          </Tag>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display nums text-xl leading-none font-semibold text-brand-800">
            {progress}%
          </span>
          <span className="nums text-[11px] text-slate-500">
            {executed} of {run.total} executed
          </span>
        </div>
      </div>

      <RunProgressBar run={run} className="mx-4 mt-2.5" />

      <RunProgressLegend run={run} className="mt-2.5 px-4" />

      <div aria-hidden className="pb-3" />

      {problemCount > 0 && (
        <div className="border-t border-hairline">
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
            className="w-full px-4 py-2.5 text-left text-xs font-medium text-brand-700 transition-colors hover:bg-surface-sunken"
          >
            {showDetails
              ? "Hide breakdown"
              : `Show failed / blocked / skipped (${problemCount})`}
          </button>
          {showDetails && (
            <div className="space-y-3 border-t border-hairline bg-surface-sunken px-4 py-3">
              <CaseList
                label="Failed"
                dotClass="bg-rose-500"
                cases={run.failedCases ?? []}
              />
              <CaseList
                label="Blocked"
                dotClass="bg-amber-400"
                cases={run.blockedCases ?? []}
              />
              <CaseList
                label="Skipped"
                dotClass="bg-slate-300"
                cases={run.skippedCases ?? []}
              />
            </div>
          )}
        </div>
      )}

      {hasRelease && (
        <div className="border-t border-hairline">
          <button
            type="button"
            onClick={toggleRelease}
            aria-expanded={showRelease}
            className="w-full px-4 py-2.5 text-left text-xs font-medium text-brand-700 transition-colors hover:bg-surface-sunken"
          >
            {showRelease
              ? "Hide release stories & bugs"
              : `Show release ${releaseNumber} stories & bugs`}
          </button>
          {showRelease && releaseState === "loading" && (
            <p className="border-t border-hairline bg-surface-sunken px-4 py-3 text-xs text-slate-500">
              Loading release {releaseNumber}…
            </p>
          )}
          {showRelease && releaseState === "error" && (
            <p className="border-t border-hairline bg-surface-sunken px-4 py-3 text-xs text-rose-700">
              Could not load release {releaseNumber}. Collapse and try again.
            </p>
          )}
          {showRelease && releaseState === "idle" && !releaseContent && (
            <p className="border-t border-hairline bg-surface-sunken px-4 py-3 text-xs text-slate-500">
              No stories or bugs recorded for release {releaseNumber}.
            </p>
          )}
          {showRelease && releaseState === "idle" && releaseContent && (
            <ReleaseDetail
              releaseNumber={releaseNumber!}
              content={releaseContent}
            />
          )}
        </div>
      )}

      {hasRelease && (
        <div className="border-t border-hairline">
          <button
            type="button"
            onClick={toggleDescopes}
            aria-expanded={showDescopes}
            className="w-full px-4 py-2.5 text-left text-xs font-medium text-brand-700 transition-colors hover:bg-surface-sunken"
          >
            {showDescopes
              ? "Hide descoped tasks"
              : `Show descoped tasks for ${releaseNumber}`}
          </button>
          {showDescopes && (
            <div className="border-t border-hairline bg-surface-sunken px-4 py-3">
              {descopeState === "loading" && (
                <p className="text-xs text-slate-500">
                  Reading Linear history for {releaseNumber}…
                </p>
              )}
              {descopeState === "error" && (
                <p className="text-xs text-rose-700">
                  Could not read descopes for {releaseNumber}. Collapse and try
                  again.
                </p>
              )}
              {descopeState === "idle" && descopes?.unavailable && (
                <p className="text-xs text-slate-500">
                  Descope history needs a Linear API key.
                </p>
              )}
              {descopeState === "idle" && descopes?.error && (
                <p className="text-xs text-amber-800">
                  Linear rejected the history query ({descopes.error}).
                </p>
              )}
              {descopeState === "idle" &&
                descopes &&
                !descopes.unavailable &&
                !descopes.error && (
                  <DescopeList
                    release={releaseNumber!}
                    events={descopes.events}
                  />
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
