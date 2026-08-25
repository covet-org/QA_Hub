import "server-only";

import { getBugsSnapshot } from "@/lib/bugs";
import {
  fetchIssuesInProjects,
  linearConfigured,
  LinearError,
} from "@/lib/linear/client";
import type { RoadmapTicket } from "@/lib/linear/types";
import { byPriority } from "@/lib/priority";
import { getRoadmapSnapshot } from "@/lib/roadmap";
import { getCoverageIndex } from "@/lib/testiny/coverage";

/** Bugs get their own list, so they are never counted as features. */
const BUG_LABELS = new Set(["Bug", "CS Bug"]);

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
  hasTestCases: boolean;
}

/** A bug shown in a release's detail. */
export interface ReleaseBug {
  id: string;
  title: string;
  url: string;
  priorityName: string | null;
  status: string;
  statusType: string;
  /** Identifier of the parent user story, if the bug is a sub-issue. */
  parentId: string | null;
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
    if (labels.some((l) => BUG_LABELS.has(l))) continue;
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
    content.bugs.sort((a, b) => byPriority(a, b) || a.id.localeCompare(b.id));
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
      parentId: t.parentId ?? null,
    }));
  }

  return out;
}
