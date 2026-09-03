"use server";

import { getDescopeSnapshot, type DescopeEvent } from "@/lib/linear/descope";
import {
  getReleaseContent,
  getStoryDescopes,
  type ReleaseContent,
} from "@/lib/release-content";
import { getStoryTestProgress } from "@/lib/testiny/queries";
import { requireAccess } from "@/lib/viewer";

/** What a descope lookup returned, including why it found nothing. */
export interface DescopeResult {
  events: DescopeEvent[];
  /** True when Linear is not configured, so nothing could be detected. */
  unavailable: boolean;
  /** Set when Linear was configured but the history query failed. */
  error: string | null;
}

/**
 * Features that left one release's scope, read from Linear issue history
 * when a viewer opens the dropdown on a run card.
 *
 * Linear is the source of truth here, deliberately: descoping is recorded
 * in the ticket's own project moves and activity, not in Testiny. A run's
 * Testiny description may also mention descoped stories, but that is a
 * hand-written note and is NOT used.
 *
 * Loaded on demand so the Releases pages cost one Testiny query — issue
 * history is the most expensive Linear call in the app.
 */
export async function loadDescopes(version: string): Promise<DescopeResult> {
  await requireAccess("/releases");
  const snapshot = await getDescopeSnapshot();
  return {
    events: snapshot.byRelease[version] ?? [],
    unavailable: snapshot.unavailable,
    error: snapshot.error,
  };
}

/**
 * Per-release stories and bugs, fetched only when a viewer actually
 * expands a release detail.
 *
 * This used to run on every Releases page view: RunsView called
 * getReleaseContent() eagerly, which pulls the whole roadmap snapshot AND
 * every product bug, to fill a panel most visits never open. Now the page
 * costs one Testiny run query, and the Linear work happens on demand.
 *
 * Access is re-checked here — a server action is a public endpoint, so it
 * cannot rely on the page having gated the render.
 */
export async function loadReleaseContent(
  version: string,
): Promise<ReleaseContent | null> {
  await requireAccess("/releases");
  const [byVersion, descopes, tests] = await Promise.all([
    getReleaseContent(),
    getStoryDescopes(),
    getStoryTestProgress(version),
  ]);
  const content = byVersion[version];
  if (!content) return null;

  // Attached here rather than inside getReleaseContent: this path already
  // runs only when a viewer expands a release, which is what makes the
  // issue-history read affordable.
  return {
    ...content,
    stories: content.stories.map((story) => ({
      ...story,
      descopes: descopes[`${version}:${story.id}`] ?? [],
      tests: tests[story.id.toUpperCase()],
    })),
  };
}
