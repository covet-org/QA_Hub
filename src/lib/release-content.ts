import "server-only";

import { getBugsSnapshot, isOpenStatus } from "@/lib/bugs";
import { env } from "@/lib/env";
import { isReleaseStory } from "@/lib/story-labels";
import type { StoryTestProgress } from "@/lib/story-tests";
import { descopesForStory, type FeatureDescope } from "@/lib/descope-history";
import { fetchReleaseProjectMoves } from "@/lib/linear/releases";
import {
  fetchIssuesInProjects,
  linearConfigured,
  LinearError,
} from "@/lib/linear/client";
import type { RoadmapTicket } from "@/lib/linear/types";
import { byPriority } from "@/lib/priority";
import { getRoadmapSnapshot } from "@/lib/roadmap";
import { getCoverageIndex } from "@/lib/testiny/coverage";

/**
 * A release lists features and bugs, nothing else.
 *
 * Read from the same settings the rest of the app uses, so the labels
 * cannot drift apart: QA_ROADMAP_LABELS decides what a feature is (the
 * roadmap already means exactly this by it) and the two bug labels are the
 * ones the bug boards are built from.
 */
const storyLabels = () => env.roadmapLabels;
const bugLabels = () => [env.bugLabel, env.csBugLabel];

/** A roadmap ticket (user story) shown in a release's detail. */
export interface ReleaseStory {
  id: string;
  title: string;
  url: string;
  /** Linear priority, for ordering the list. */
  priorityName: string | null;
  /** Roadmap labels present (e.g. "Medium to Big Size Features", "Quick wins"). */
  labels: string[];
  status: string;
  statusType: string;
  /** Linear assignee's full name, or null when nobody owns it. */
  assigneeName: string | null;
  hasTestCases: boolean;
  /**
   * How far this story's cases got in the release's Dev/Sandbox run.
   *
   * Absent by default and filled in on the Releases panels only — the
   * roadmap answers "does it have test cases at all", this answers "how
   * far did they get in this release".
   */
  tests?: StoryTestProgress;
  /**
   * Releases this feature was pushed out of before landing here, most
   * recent exit first, each with the bugs it already had at that moment.
   *
   * Optional and absent by default: it costs a Linear issue-history read,
   * which is the most expensive call in the app, so it is filled in only
   * where it is actually shown — see getStoryDescopes.
   */
  descopes?: FeatureDescope<ReleaseBug>[];
}

/** A bug shown in a release's detail. */
export interface ReleaseBug {
  id: string;
  title: string;
  url: string;
  priorityName: string | null;
  status: string;
  statusType: string;
  /** Linear assignee's full name, or null when nobody owns it. */
  assigneeName: string | null;
  /** Identifier of the parent user story, if the bug is a sub-issue. */
  parentId: string | null;
  /** When the bug was filed — what decides whether it predates a descope. */
  createdAt?: string | null;
}

export interface ReleaseContent {
  stories: ReleaseStory[];
  bugs: ReleaseBug[];
}

const versionOf = (name: string): string | null =>
  name.match(/(\d+\.\d+)/)?.[1] ?? null;

/**
 * Per-release content for the Releases detail panels: user stories
 * (roadmap tickets) and bugs, keyed by version string ("3.32").
 * Built from the roadmap and bug snapshots so it reuses their caches.
 */
export async function getReleaseContent(): Promise<
  Record<string, ReleaseContent>
> {
  const [roadmap, bugs] = await Promise.all([
    getRoadmapSnapshot(),
    getBugsSnapshot("product"),
  ]);

  const out: Record<string, ReleaseContent> = {};
  const bucket = (version: string): ReleaseContent =>
    (out[version] ??= { stories: [], bugs: [] });

  // What shipped in a release is the release project's contents minus its
  // bugs — not the roadmap-labelled subset. Shipped work loses its roadmap
  // label, so a past release reads as empty by label and full by project.
  const releaseNames = [
    ...new Set(
      [...roadmap.groups, ...bugs.groups]
        .filter((g) => g.isRelease)
        .map((g) => g.name),
    ),
  ];

  let projectIssues: RoadmapTicket[] = [];
  if (releaseNames.length > 0 && linearConfigured()) {
    try {
      projectIssues = await fetchIssuesInProjects(releaseNames);
    } catch (error) {
      if (!(error instanceof LinearError)) throw error;
      // Features degrade to the roadmap-labelled set below rather than
      // taking the whole page down with them.
      console.warn(`Release features unavailable: ${error.message}`);
    }
  }

  const coverage = await getCoverageIndex();
  const hasCases = (id: string): boolean =>
    (coverage.get(id.toUpperCase()) ?? []).some((f) => f.caseCount > 0);

  const seen = new Set<string>();
  const addStory = (version: string, story: ReleaseStory): void => {
    const key = `${version}:${story.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    bucket(version).stories.push(story);
  };

  // Gathered before anything is added, because whether an issue is a
  // feature depends on what else is in the release: a sub-issue whose
  // parent is here too is a step of that feature, not a feature. Without
  // this, 3.36 listed "QA Review", "Gabriel Review" and "1. Recording
  // Widget" as features of their own. The parent row stands for them,
  // exactly as the roadmap board nests them.
  const candidates: {
    version: string;
    parentId: string | null;
    story: ReleaseStory;
  }[] = [];

  for (const ticket of projectIssues) {
    const version = ticket.project ? versionOf(ticket.project) : null;
    if (!version) continue;
    // allLabels is optional on the type (fixtures omit it), so fall back
    // to the display labels rather than treating a bug as a feature.
    const labels = ticket.allLabels ?? ticket.labels;
    // A release project holds more than features: chores, spikes and
    // container tickets live there too. Only labelled work is a story —
    // without this every unlabelled ticket rendered as one.
    if (!isReleaseStory(labels, storyLabels(), bugLabels())) continue;
    // Cancelled work never shipped, so it is not a feature of the release.
    if (ticket.statusType === "canceled") continue;
    candidates.push({
      version,
      parentId: ticket.parentId ?? null,
      story: {
        id: ticket.id,
        title: ticket.title,
        url: ticket.url,
        labels: ticket.labels,
        priorityName: ticket.priorityName ?? null,
        status: ticket.status,
        statusType: ticket.statusType,
        assigneeName: ticket.assigneeName ?? null,
        hasTestCases: hasCases(ticket.id),
      },
    });
  }

  // A roadmap story parked outside the release project still belongs to it.
  for (const group of roadmap.groups) {
    if (!group.isRelease) continue;
    const version = versionOf(group.name);
    if (!version) continue;
    for (const t of group.tickets) {
      // These arrive already filtered by roadmap label, but the check is
      // repeated rather than assumed: two paths feeding one list must not
      // disagree about what belongs in it.
      if (!isReleaseStory(t.allLabels ?? t.labels, storyLabels(), bugLabels()))
        continue;
      candidates.push({
        version,
        parentId: t.parentId ?? null,
        story: {
          id: t.id,
          title: t.title,
          url: t.url,
          labels: t.labels,
          priorityName: t.priorityName ?? null,
          status: t.status,
          statusType: t.statusType,
          assigneeName: t.assigneeName ?? null,
          hasTestCases: t.hasTestCases,
        },
      });
    }
  }

  const present = new Set(candidates.map((c) => `${c.version}:${c.story.id}`));
  for (const c of candidates) {
    // A sub-issue whose parent is elsewhere still needs its own row —
    // nothing in this release speaks for it.
    if (c.parentId && present.has(`${c.version}:${c.parentId}`)) continue;
    addStory(c.version, c.story);
  }

  // Priority first, as everywhere else; uncovered before covered still
  // breaks the ties so the coverage gaps read within each band.
  for (const content of Object.values(out)) {
    content.stories.sort(
      (a, b) =>
        byPriority(a, b) ||
        Number(a.hasTestCases) - Number(b.hasTestCases) ||
        a.id.localeCompare(b.id),
    );
    // Open first here too, so a release panel and the bug board agree.
    content.bugs.sort(
      (a, b) =>
        Number(isOpenStatus(b.statusType)) -
          Number(isOpenStatus(a.statusType)) ||
        byPriority(a, b) ||
        a.id.localeCompare(b.id),
    );
  }

  for (const group of bugs.groups) {
    if (!group.isRelease) continue;
    const version = versionOf(group.name);
    if (!version) continue;
    bucket(version).bugs = group.tickets.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      priorityName: t.priorityName ?? null,
      status: t.status,
      statusType: t.statusType,
      assigneeName: t.assigneeName ?? null,
      parentId: t.parentId ?? null,
      createdAt: t.createdAt ?? null,
    }));
  }

  return out;
}

/**
 * Descope history per story, keyed "3.37:COV-1234".
 *
 * Kept OUT of getReleaseContent on purpose. It reads Linear issue history
 * — the most expensive call in the app — and getReleaseContent sits on
 * Home's blocking path, where one serial await of this made the page
 * visibly slower. Home now streams it in behind Suspense and the Releases
 * panels pick it up on the lazy path they were already on.
 *
 * Bugs are pooled across every group rather than taken per release: a bug
 * filed against this feature while it sat in 3.35 is exactly the bug that
 * explains the descope, and by now it lives under whichever project the
 * feature moved to.
 *
 * A Linear failure returns an empty map, so the surfaces lose the history
 * and nothing else.
 */
export async function getStoryDescopes(): Promise<
  Record<string, FeatureDescope<ReleaseBug>[]>
> {
  if (!linearConfigured()) return {};

  const [content, bugs] = await Promise.all([
    getReleaseContent(),
    getBugsSnapshot("product"),
  ]);
  const releaseNames = Object.keys(content).map((v) => `${v} Release`);
  if (releaseNames.length === 0) return {};

  const allBugs: ReleaseBug[] = bugs.groups.flatMap((group) =>
    group.tickets.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      priorityName: t.priorityName ?? null,
      status: t.status,
      statusType: t.statusType,
      assigneeName: t.assigneeName ?? null,
      parentId: t.parentId ?? null,
      createdAt: t.createdAt ?? null,
    })),
  );

  const out: Record<string, FeatureDescope<ReleaseBug>[]> = {};
  try {
    const moves = await fetchReleaseProjectMoves(releaseNames);
    for (const [version, release] of Object.entries(content)) {
      for (const story of release.stories) {
        const descopes = descopesForStory(
          story.id,
          version,
          moves.descopesByFeature[story.id],
          allBugs,
        );
        // Only the features that were actually descoped, so the map stays
        // small enough to hand to a client component.
        if (descopes.length > 0) out[`${version}:${story.id}`] = descopes;
      }
    }
  } catch (error) {
    if (!(error instanceof LinearError)) throw error;
    console.warn(`Descope history unavailable: ${error.message}`);
  }
  return out;
}
