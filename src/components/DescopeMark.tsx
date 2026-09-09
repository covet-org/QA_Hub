"use client";

import { createContext, Suspense, use, useContext } from "react";

import type { RoadmapDescopeMap } from "@/lib/roadmap-descopes";
import { Tag } from "@/components/ui";

/**
 * The "descoped from …" tag on a roadmap row.
 *
 * The map arrives as a promise rather than a resolved prop, and that is
 * the point: reading issue history is the slowest call in the app, and the
 * board must not wait on it. Each tag suspends on its own, so the list
 * renders immediately and the tags fill in — without the board itself
 * unmounting, which is what would reset an open parent row or a filter
 * chosen in the meantime.
 */
const DescopeContext = createContext<Promise<RoadmapDescopeMap> | null>(null);

export function DescopeProvider({
  promise,
  children,
}: {
  promise?: Promise<RoadmapDescopeMap>;
  children: React.ReactNode;
}) {
  return (
    <DescopeContext.Provider value={promise ?? null}>
      {children}
    </DescopeContext.Provider>
  );
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Mark({
  id,
  promise,
}: {
  id: string;
  promise: Promise<RoadmapDescopeMap>;
}) {
  const descopes = use(promise)[id];
  if (!descopes || descopes.length === 0) return null;

  const latest = descopes[0];
  return (
    <Tag
      className="bg-amber-50 text-amber-800 ring-amber-200"
      title={descopes
        .map(
          (d) =>
            `Pushed out of ${d.fromRelease} ${
              d.toRelease
                ? `into ${d.toRelease}`
                : d.toProject
                  ? `into ${d.toProject}`
                  : "out of every project"
            } on ${stamp(d.at)}`,
        )
        .join("\n")}
    >
      {descopes.length === 1
        ? `descoped from ${latest.fromRelease}`
        : `descoped ${descopes.length}×, last from ${latest.fromRelease}`}
    </Tag>
  );
}

export function DescopeMark({ id }: { id: string }) {
  const promise = useContext(DescopeContext);
  if (!promise) return null;
  // fallback null: a tag that is not there yet should leave no gap, so the
  // row does not reflow when it arrives.
  return (
    <Suspense fallback={null}>
      <Mark id={id} promise={promise} />
    </Suspense>
  );
}
