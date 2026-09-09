"use client";

import { createContext, useContext } from "react";

import type { RoadmapDescopeMap } from "@/lib/roadmap-descopes";
import { Tag } from "@/components/ui";

/**
 * The "descoped from …" tag on a roadmap row.
 *
 * Carried in context rather than threaded through every row: the board
 * renders leaf rows, parent rows and nested children from three call
 * sites, and prop-drilling a map through all of them to reach a tag is
 * noise.
 *
 * The map is resolved data, not a promise. It decides row ORDER as well as
 * the tag — descoped tickets sort to the top — and a list cannot be
 * ordered by something that has not arrived.
 */
const DescopeContext = createContext<RoadmapDescopeMap>({});

export function DescopeProvider({
  value,
  children,
}: {
  value?: RoadmapDescopeMap;
  children: React.ReactNode;
}) {
  return (
    <DescopeContext.Provider value={value ?? {}}>
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

export function DescopeMark({ id }: { id: string }) {
  const descopes = useContext(DescopeContext)[id];
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
