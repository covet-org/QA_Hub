"use server";

import { getReleaseContent, type ReleaseContent } from "@/lib/release-content";
import { requireAccess } from "@/lib/viewer";

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
  const byVersion = await getReleaseContent();
  return byVersion[version] ?? null;
}
