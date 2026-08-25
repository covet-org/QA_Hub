"use client";

import { useMemo } from "react";
import {
  DataRow,
  Disclosure,
  EmptyState,
  Meta,
  Slot,
  Tag,
  TicketLink,
} from "@/components/ui";
import type { ReleaseStory } from "@/lib/release-content";

const STORY_LABEL: Record<string, string> = {
  "Medium to Big Size Features": "Medium/Big",
  "Quick wins": "Quick win",
};

const STORY_LABEL_TONE: Record<string, string> = {
  "Medium to Big Size Features": "bg-violet-50 text-violet-700 ring-violet-200",
  "Quick wins": "bg-teal-50 text-teal-700 ring-teal-200",
};

const statusTone: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-600 ring-slate-200",
  unstarted: "bg-slate-100 text-slate-600 ring-slate-200",
  started: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  canceled: "bg-slate-100 text-slate-400 ring-slate-200",
};

export interface ReleaseFeatureGroup {
  release: string;
  rank: number;
  stories: ReleaseStory[];
}

/**
 * Which features went out in each release, under the bug trend chart on
 * Home: the same releases, seen as content rather than as counts.
 *
 * Built entirely from the library — Disclosure, DataRow, Slot, Meta, Tag —
 * so it matches the roadmap and bug boards row for row, and from the
 * release content the Releases page already fetches.
 */
export function ReleaseFeatures({
  groups,
}: {
  groups: ReleaseFeatureGroup[];
}) {
  const shown = useMemo(() => groups.filter((g) => g.stories.length > 0), [
    groups,
  ]);

  if (shown.length === 0) {
    return <EmptyState>No released features found for these releases.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {shown.map((group, index) => {
        const done = group.stories.filter(
          (s) => s.statusType === "completed",
        ).length;
        const covered = group.stories.filter((s) => s.hasTestCases).length;
        return (
          <Disclosure
            key={group.release}
            // Only the newest release opens: the rest are history.
            defaultOpen={index === 0}
            title={
              <>
                <span aria-hidden className="size-1.5 rounded-full bg-brand-600" />
                {group.release} Release
              </>
            }
            summary={
              <span className="nums text-[11px] text-slate-500">
                {group.stories.length} feature
                {group.stories.length === 1 ? "" : "s"} · {done} done ·{" "}
                {covered} with test cases
              </span>
            }
          >
            <ul className="divide-y divide-hairline">
              {group.stories.map((story) => (
                <DataRow
                  key={story.id}
                  leading={<TicketLink id={story.id} url={story.url} />}
                  slots={
                    <Slot width={84}>
                      {story.labels
                        .filter((l) => STORY_LABEL[l])
                        .slice(0, 1)
                        .map((l) => (
                          <Tag key={l} className={STORY_LABEL_TONE[l]}>
                            {STORY_LABEL[l]}
                          </Tag>
                        ))}
                    </Slot>
                  }
                  title={story.title}
                  titleAttr={story.title}
                  trailing={
                    <>
                      <Tag
                        className={
                          statusTone[story.statusType] ?? statusTone.backlog
                        }
                      >
                        {story.status}
                      </Tag>
                      <Meta
                        width={92}
                        muted={!story.hasTestCases}
                        title={
                          story.hasTestCases
                            ? "Has Testiny test cases"
                            : "No Testiny test cases"
                        }
                      >
                        {story.hasTestCases ? "✓ test cases" : "no test cases"}
                      </Meta>
                    </>
                  }
                />
              ))}
            </ul>
          </Disclosure>
        );
      })}
    </div>
  );
}
