"use client";

import { loadDescopes, type DescopeResult } from "@/lib/release-actions";

/**
 * Per-release descope fetches, shared across run cards.
 *
 * Descopes belong to a release, not to a run, so every run of one release
 * — dev, regression, sandbox — shows the same list. Without this, opening
 * the dropdown on each of them would hit the server action once per card
 * for identical data.
 *
 * The promise is cached, not just the result, so cards opened at the same
 * moment share one in-flight request. A failure is evicted so a retry can
 * re-fetch, and the whole cache dies with the page — server-side
 * revalidation stays the source of freshness.
 */
const byRelease = new Map<string, Promise<DescopeResult>>();

export function fetchDescopes(version: string): Promise<DescopeResult> {
  const cached = byRelease.get(version);
  if (cached) return cached;

  const pending = loadDescopes(version).catch((error: unknown) => {
    byRelease.delete(version);
    throw error;
  });
  byRelease.set(version, pending);
  return pending;
}
