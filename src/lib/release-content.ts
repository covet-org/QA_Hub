import "server-only";

import { getBugsSnapshot } from "@/lib/bugs";
import { getRoadmapSnapshot } from "@/lib/roadmap";

/** A roadmap ticket (user story) shown in a release's detail. */
export interface ReleaseStory {
  id: string;
  title: string;
  url: string;
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

  for (const group of roadmap.groups) {
    if (!group.isRelease) continue;
    const version = versionOf(group.name);
    if (!version) continue;
    bucket(version).stories = group.tickets.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      labels: t.labels,
      status: t.status,
      statusType: t.statusType,
      hasTestCases: t.hasTestCases,
    }));
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
