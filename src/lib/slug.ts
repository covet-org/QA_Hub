/**
 * URL-safe key for a group name, e.g. "3.36 Release" -> "3.36-release".
 *
 * Lives in its own module, with no "use client" and no server-only, because
 * both sides need it: the filter components write these slugs into the
 * query string, and Home builds pre-filtered links to the same boards.
 * It previously sat in use-url-filter.ts, which is a client module — the
 * import type-checked and built fine, then threw at request time when a
 * server component called it. Neither tsc nor eslint can see that; only
 * loading the page can.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
}
