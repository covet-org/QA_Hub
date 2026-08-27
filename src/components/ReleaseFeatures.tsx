"use client";

import {
  DataRow,
  DEFAULT_RELEASES_SHOWN,
  Disclosure,
  EmptyState,
  Meta,
  RevealMoreButton,
  Slot,
  Tag,
  TicketLink,
  useRevealMore,
} from "@/components/ui";
import { DescopeTag, StoryDescopeHistory } from "@/components/StoryDescopes";
import type { ReleaseStory } from "@/lib/release-content";

const STORY_LABEL: Record<string, string> = {
  "Medium to Big Size Features": "Medium/Big",
  "Quick wins": "Quick win",
};

const STORY_LABEL_TONE: Record<string, string> = {
  "Medium to Big Size Features": "bg-violet-50 text-violet-700 ring-violet-200",
  "Quick wins": "bg-teal-50 text-teal-700 ring-teal-200",
};

/**
 * The streamed map wins when it has an entry, and a story that already
 * carries its own history (the Releases panels attach it directly) still
 * works — one helper so neither surface needs to know which path it is on.
 */
function descopeOf(
  descopes: StoryDescopeMap,
  release: string,
  story: ReleaseStory,
): NonNullable<ReleaseStory["descopes"]> {
  return descopes[`${release}:${story.id}`] ?? story.descopes ?? [];
}

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

/** Descope history keyed "3.37:COV-1234", streamed in after first paint. */
export type StoryDescopeMap = Record<
  string,
  NonNullable<ReleaseStory["descopes"]>
>;

/**
 * Which features went out in each release, under the bug trend chart on
 * Home: the same releases, seen as content rather than as counts.
 *
 * Shows the last two releases and folds the rest behind "+ More", the
 * same affordance and the same count as the chart above — the two cards
 * are one story told twice, so they must never disagree about which
 * releases are on screen. A release with nothing recorded still gets its
 * row, saying so: dropping it silently is what made them disagree.
 *
 * Built entirely from the library — Disclosure, DataRow, Slot, Meta, Tag —
 * so it matches the roadmap and bug boards row for row, and from the
 * release content the Releases page already fetches.
 */
export function ReleaseFeatures({
  groups,
  descopes = {},
}: {
  groups: ReleaseFeatureGroup[];
  /**
   * Absent on the first paint and filled in when the issue-history read
   * resolves, so the feature list is never waiting on it.
   */
  descopes?: StoryDescopeMap;
}) {
  const {
    visible: shown,
    expanded,
    hiddenCount,
    toggle,
  } = useRevealMore(groups, DEFAULT_RELEASES_SHOWN);

  if (groups.length === 0) {
    return <EmptyState>No releases found.</EmptyState>;
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
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-brand-600"
                />
                {group.release} Release
              </>
            }
            summary={
              <span className="nums text-[11px] text-slate-500">
                {group.stories.length === 0 ? (
                  "no features recorded"
                ) : (
                  <>
                    {group.stories.length} feature
                    {group.stories.length === 1 ? "" : "s"} · {done} done ·{" "}
                    {covered} with test cases
                  </>
                )}
              </span>
            }
          >
            {group.stories.length === 0 && (
              <EmptyState>
                Nothing but bugs recorded against {group.release} in Linear.
              </EmptyState>
            )}
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
                  below={
                    descopeOf(descopes, group.release, story).length > 0 ? (
                      <div className="mt-1.5 pl-[4.5rem]">
                        <StoryDescopeHistory
                          descopes={descopeOf(descopes, group.release, story)}
                        />
                      </div>
                    ) : undefined
                  }
                  trailing={
                    <>
                      <DescopeTag
                        descopes={descopeOf(descopes, group.release, story)}
                      />
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
      <RevealMoreButton
        expanded={expanded}
        hiddenCount={hiddenCount}
        onToggle={toggle}
      />
    </div>
  );
}
