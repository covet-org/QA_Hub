"use client";

import { useState } from "react";
import type { CaseRef, RunSummary } from "@/lib/testiny/types";
import { Tag } from "@/components/Tag";

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
          <li key={tc.id} className="flex items-baseline gap-3">
            <a
              href={tc.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-mono text-xs font-semibold text-brand-700 hover:underline"
            >
              TC-{tc.id}
            </a>
            <span
              className="min-w-0 truncate text-sm text-slate-800"
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
export function RunCard({ run }: { run: RunSummary }) {
  const [showDetails, setShowDetails] = useState(false);
  const executed = run.total - run.notRun;
  const progress = run.total > 0 ? Math.round((executed / run.total) * 100) : 0;
  const problemCount =
    (run.failedCases?.length ?? 0) +
    (run.blockedCases?.length ?? 0) +
    (run.skippedCases?.length ?? 0);

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
    </div>
  );
}
