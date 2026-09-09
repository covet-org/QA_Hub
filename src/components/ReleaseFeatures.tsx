"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { loadReleaseFeatures } from "@/lib/release-actions";
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
  loadedReleases,
}: {
  groups: ReleaseFeatureGroup[];
  /**
   * Absent on the first paint and filled in when the issue-history read
   * resolves, so the feature list is never waiting on it.
   */
  descopes?: StoryDescopeMap;
  /**
   * Releases whose stories are already here. The rest are named but empty
   * until revealed — Home renders two and there are thirty.
   */
  loadedReleases?: string[];
}) {
  const [extra, setExtra] = useState<Record<string, ReleaseStory[]>>({});
  const [extraDescopes, setExtraDescopes] = useState<StoryDescopeMap>({});
  const [loading, setLoading] = useState<string[]>([]);
  // Requested, not just loaded: revealing and hiding twice in quick
  // succession would otherwise fetch the same releases again.
  const requested = useRef(new Set(loadedReleases ?? []));
  const {
    visible: shown,
    expanded,
    hiddenCount,
    toggle,
  } = useRevealMore(groups, DEFAULT_RELEASES_SHOWN);

  // Driven by what is on screen rather than by the click itself, so the
  // rule holds however the list is revealed.
  const shownKey = shown.map((g) => g.release).join("|");
  useEffect(() => {
    const wanted = shownKey
      .split("|")
      .filter((release) => release && !requested.current.has(release));
    if (wanted.length === 0) return;

    for (const release of wanted) requested.current.add(release);
    setLoading((current) => [...current, ...wanted]);

    void loadReleaseFeatures(wanted)
      .then((data) => {
        setExtra((current) => ({ ...current, ...data.stories }));
        setExtraDescopes((current) => ({ ...current, ...data.descopes }));
      })
      .catch(() => {
        // Forget it so a second reveal retries, rather than leaving the
        // release stuck showing nothing.
        for (const release of wanted) requested.current.delete(release);
      })
      .finally(() =>
        setLoading((current) =>
          current.filter((release) => !wanted.includes(release)),
        ),
      );
  }, [shownKey]);

  const allDescopes = useMemo(
    () => ({ ...descopes, ...extraDescopes }),
    [descopes, extraDescopes],
  );

  const storiesFor = useMemo(
    () => (group: ReleaseFeatureGroup) =>
      group.stories.length > 0 ? group.stories : (extra[group.release] ?? []),
    [extra],
  );

  if (groups.length === 0) {
    return <EmptyState>No releases found.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {shown.map((group, index) => {
        const stories = storiesFor(group);
        const isLoading = loading.includes(group.release);
        const done = stories.filter((s) => s.statusType === "completed").length;
        const covered = stories.filter((s) => s.hasTestCases).length;
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
                {isLoading ? (
                  "loading…"
                ) : stories.length === 0 ? (
                  "no features recorded"
                ) : (
                  <>
                    {stories.length} feature
                    {stories.length === 1 ? "" : "s"} · {done} done · {covered}{" "}
                    with test cases
                  </>
                )}
              </span>
            }
          >
            {isLoading && (
              <p
                role="status"
                className="animate-pulse px-4 py-6 text-center text-[13px] text-slate-500"
              >
                Loading {group.release}…
              </p>
            )}
            {stories.length === 0 && !isLoading && (
              <EmptyState>
                Nothing but bugs recorded against {group.release} in Linear.
              </EmptyState>
            )}
            <ul className="divide-y divide-hairline">
              {stories.map((story) => (
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
                    descopeOf(allDescopes, group.release, story).length > 0 ? (
                      <div className="mt-1.5 pl-[4.5rem]">
                        <StoryDescopeHistory
                          descopes={descopeOf(
                            allDescopes,
                            group.release,
                            story,
                          )}
                        />
                      </div>
                    ) : undefined
                  }
                  trailing={
                    <>
                      <DescopeTag
                        descopes={descopeOf(allDescopes, group.release, story)}
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
