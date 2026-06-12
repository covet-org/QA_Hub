/** Shared helpers for Linear "X.YZ Release" project names. */

export const RELEASE_NAME = /^(\d+)\.(\d+)\s+Release$/i;

/** Extract a sortable version rank from text, e.g. "3.32 Release" → 3032. */
export function versionRank(text: string): number | null {
  const match = text.match(/(\d+)\.(\d+)/);
  if (!match) return null;
  return Number(match[1]) * 1000 + Number(match[2]);
}

/** Sort key: release projects newest-first, then other projects, then none. */
export function releaseRank(name: string | null): number {
  if (!name) return -1;
  if (!RELEASE_NAME.test(name)) return 0;
  return versionRank(name) ?? 0;
}
