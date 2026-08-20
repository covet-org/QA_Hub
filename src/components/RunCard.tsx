"use client";

import { useState } from "react";
import type {
  ReleaseBug,
  ReleaseContent,
  ReleaseStory,
} from "@/lib/release-content";
import type { CaseRef, RunSummary } from "@/lib/testiny/types";
import { Tag } from "@/components/Tag";

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

const runStatusTone: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 ring-slate-200",
  unstarted: "bg-slate-100 text-slate-600 ring-slate-200",
  started: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-400 ring-slate-200",
};

function TicketLink({ id, url }: { id: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 font-mono text-xs font-semibold text-brand-700 hover:underline"
    >
      {id}
    </a>
  );
}

function StoryRow({ story }: { story: ReleaseStory }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <TicketLink id={story.id} url={story.url} />
      <span
        className="min-w-0 flex-1 truncate text-sm text-slate-800"
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
    </li>
  );
}

function BugRow({ bug }: { bug: ReleaseBug }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <TicketLink id={bug.id} url={bug.url} />
      <span
        className="min-w-0 flex-1 truncate text-sm text-slate-800"
        title={bug.title}
      >
        {bug.title}
      </span>
      <Tag className={runStatusTone[bug.statusType] ?? runStatusTone.backlog}>
        {bug.status}
      </Tag>
    </li>
  );
}

function ReleaseDetail({
  releaseNumber,
  content,
}: {
  releaseNumber: string;
  content: ReleaseContent;
}) {
  const bugsByPriority = PRIORITY_BUCKETS.map((priority) => ({
    priority,
    bugs: content.bugs.filter(
      (b) => (b.priorityName ?? "No priority") === priority,
    ),
  })).filter((g) => g.bugs.length > 0);

  return (
    <div className="mt-3 space-y-4 border-t border-slate-100 pt-3">
      <p className="font-display text-sm font-semibold text-slate-800">
        Release {releaseNumber}
      </p>

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          User stories ({content.stories.length})
        </p>
        {content.stories.length > 0 ? (
          <ul className="mt-1.5 divide-y divide-slate-100">
            {content.stories.map((s) => (
              <StoryRow key={s.id} story={s} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            No roadmap tickets for this release.
          </p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Bugs ({content.bugs.length})
        </p>
        {bugsByPriority.length > 0 ? (
          <div className="mt-2 space-y-2.5">
            {bugsByPriority.map(({ priority, bugs }) => (
              <div
                key={priority}
                className="overflow-hidden rounded-xl ring-1 ring-slate-200"
              >
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
                    priorityTone[priority]
                  }`}
                >
                  <span className={`size-2 rounded-full ${priorityDot[priority]}`} />
                  {priority} ({bugs.length})
                </div>
                <ul className="divide-y divide-slate-100 px-3">
                  {bugs.map((b) => (
                    <BugRow key={b.id} bug={b} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No bugs for this release.</p>
        )}
      </div>
    </div>
  );
}

const SEGMENTS = [
  { key: "passed", className: "bg-emerald-500", label: "Passed" },
  { key: "failed", className: "bg-rose-500", label: "Failed" },
  { key: "blocked", className: "bg-amber-400", label: "Blocked" },
  { key: "skipped", className: "bg-slate-300", label: "Skipped" },
  { key: "notRun", className: "bg-slate-200", label: "Not run" },
] as const;

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
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <span className={`size-2 rounded-full ${dotClass}`} />
        {label} ({cases.length})
      </p>
      <ul className="mt-1.5 space-y-1">
        {cases.map((tc) => (
          <li key={tc.id} className="flex items-baseline gap-2.5 text-sm">
            <a
              href={tc.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-semibold text-brand-700 hover:underline"
            >
              TC-{tc.id}
            </a>
            <span
              className="min-w-0 truncate text-slate-800"
              title={tc.title}
            >
              {tc.title}
            </span>
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
  releaseContent,
}: {
  run: RunSummary;
  releaseNumber?: string;
  releaseContent?: ReleaseContent;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  const executed = run.total - run.notRun;
  const progress = run.total > 0 ? Math.round((executed / run.total) * 100) : 0;
  const problemCount =
    (run.failedCases?.length ?? 0) +
    (run.blockedCases?.length ?? 0) +
    (run.skippedCases?.length ?? 0);
  const hasRelease =
    !!releaseNumber &&
    !!releaseContent &&
    (releaseContent.stories.length > 0 || releaseContent.bugs.length > 0);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-slate-800">{run.title}</h3>
        <Tag
          className={
            run.isClosed
              ? "bg-slate-100 text-slate-600 ring-slate-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
          }
        >
          {run.isClosed ? "Closed" : "Active"}
        </Tag>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {executed} of {run.total} executed · {progress}%
      </p>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {SEGMENTS.map(({ key, className }) => {
          const value = run[key];
          if (!value || run.total === 0) return null;
          return (
            <div
              key={key}
              className={className}
              style={{ width: `${(value / run.total) * 100}%` }}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {SEGMENTS.map(({ key, className, label }) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${className}`} />
            {label} {run[key]}
          </span>
        ))}
      </div>

      {problemCount > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {showDetails
              ? "Hide breakdown"
              : `Show failed / blocked / skipped (${problemCount})`}
          </button>
          {showDetails && (
            <div className="mt-3 space-y-3">
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
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowRelease((s) => !s)}
            aria-expanded={showRelease}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {showRelease
              ? "Hide release stories & bugs"
              : `Show release ${releaseNumber} stories & bugs (${releaseContent!.stories.length} stories · ${releaseContent!.bugs.length} bugs)`}
          </button>
          {showRelease && (
            <ReleaseDetail
              releaseNumber={releaseNumber!}
              content={releaseContent!}
            />
          )}
        </div>
      )}
    </div>
  );
}
