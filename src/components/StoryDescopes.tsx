"use client";

import { useState } from "react";
import type { FeatureDescope } from "@/lib/descope-history";
import type { ReleaseBug } from "@/lib/release-content";
import { Tag } from "@/components/ui";

type Descope = FeatureDescope<ReleaseBug>;

/**
 * A feature's descope history, shown against the feature on both Home's
 * "Features per release" card and the Releases panels. One component so
 * the two surfaces cannot drift apart on wording or on which bugs count.
 *
 * The claim is deliberately narrow. "2 bugs filed by then" says those bugs
 * existed against this feature when it was pushed out — which is what the
 * bug list is fetched for. It does NOT say they were open at that moment:
 * that would need each bug's state history, which nothing here fetches, so
 * every bug carries the status it has now and is labelled as such.
 */
function stamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Where it landed, in the words the board uses elsewhere. */
function destination(d: Descope): string {
  if (d.toRelease) return `into ${d.toRelease}`;
  if (d.toProject) return `into ${d.toProject}`;
  return "out of every project";
}

function summary(descopes: Descope[]): string {
  return descopes
    .map(
      (d) =>
        `Descoped from ${d.fromRelease} ${destination(d)} on ${stamp(d.at)}` +
        (d.bugsAtTheTime.length > 0
          ? ` with ${d.bugsAtTheTime.length} bug${d.bugsAtTheTime.length === 1 ? "" : "s"} already filed`
          : " with no bugs filed against it yet"),
    )
    .join("\n");
}

/**
 * The row-level marker. Names the release it slipped from rather than just
 * counting, because "descoped from 3.35" is the fact a reader acts on and
 * a bare count is not.
 *
 * The release named is the MOST RECENT exit — the list arrives newest
 * first. Naming the oldest one instead made the tag disagree with the
 * first line of the history it opens.
 */
export function DescopeTag({ descopes }: { descopes: Descope[] }) {
  if (descopes.length === 0) return null;
  const latest = descopes[0];
  const label =
    descopes.length === 1
      ? `descoped from ${latest.fromRelease}`
      : `descoped ${descopes.length}×, last from ${latest.fromRelease}`;
  return (
    <Tag
      className="bg-amber-50 text-amber-800 ring-amber-200"
      title={summary(descopes)}
    >
      {label}
    </Tag>
  );
}

/**
 * The full history: each move, and the bugs it already carried.
 *
 * Behind its own toggle, closed by default. On a release where several
 * features slipped, the expanded histories were taller than the feature
 * list they belonged to — the count is what a reader scans for, and the
 * detail is what they open one of.
 */
export function StoryDescopeHistory({
  descopes,
  defaultOpen = false,
}: {
  descopes: Descope[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (descopes.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-amber-800 uppercase transition-colors hover:text-amber-900"
        title={summary(descopes)}
      >
        <span aria-hidden className="text-[9px]">
          {open ? "▾" : "▸"}
        </span>
        Descope history ({descopes.length})
      </button>
      <ul className={open ? "mt-1 space-y-1.5" : "hidden"}>
        {descopes.map((d) => (
          <li
            key={`${d.fromRelease}-${d.at}`}
            className="border-l-2 border-amber-200 pl-2.5"
          >
            <p className="text-[12px] text-slate-700">
              Pushed out of{" "}
              <span className="font-medium text-slate-800">
                {d.fromRelease}
              </span>{" "}
              {destination(d)}
              <span className="nums text-slate-500"> · {stamp(d.at)}</span>
            </p>
            {d.bugsAtTheTime.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                no bug was filed against it by then
              </p>
            ) : (
              <>
                <p className="text-[11px] text-slate-500">
                  {d.bugsAtTheTime.length} bug
                  {d.bugsAtTheTime.length === 1 ? "" : "s"} filed by then —
                  status shown as it stands now
                </p>
                <ul className="mt-0.5">
                  {d.bugsAtTheTime.map((bug) => (
                    <li
                      key={bug.id}
                      className="flex flex-wrap items-baseline gap-x-2 py-0.5"
                    >
                      <a
                        href={bug.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 font-mono text-[11px] font-semibold text-brand-700 hover:underline"
                      >
                        {bug.id}
                      </a>
                      <span
                        className="min-w-0 flex-1 truncate text-[12px] text-slate-700"
                        title={bug.title}
                      >
                        {bug.title}
                      </span>
                      {bug.priorityName && (
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {bug.priorityName}
                        </span>
                      )}
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {bug.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
