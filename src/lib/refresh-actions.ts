"use server";

import { updateTag } from "next/cache";

import { ALL_UPSTREAM_TAGS } from "@/lib/cache-tags";
import { getViewer } from "@/lib/viewer";

/**
 * Throw away every cached upstream read, so the next render goes back to
 * Linear and Testiny.
 *
 * Called on an actual page reload and on the auto-refresh tick — not on
 * navigation between pages, which is what the caches are for. That split
 * is the whole point: clicking around stays fast, while "I changed it in
 * Linear and pressed reload" gets the change.
 *
 * Gated on a signed-in viewer. A server action is a public endpoint, and
 * this one spends the API quota of whoever calls it; it returns nothing
 * either way, so an unauthorised caller learns nothing from the silence.
 */
export async function refreshUpstreamData(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.status === "blocked") return;
  // updateTag rather than revalidateTag: Next documents it as the
  // server-action API with read-your-own-writes semantics, which is
  // exactly the contract here — the render that follows this call must
  // see the new data, not the entry we just marked stale.
  for (const tag of ALL_UPSTREAM_TAGS) updateTag(tag);
}
