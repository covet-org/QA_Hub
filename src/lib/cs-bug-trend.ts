import type { ReleaseTrend, TrendPoint } from "./bug-trend";
import { versionRank } from "./release-utils";

/**
 * Customer-service bug curves, one per release.
 *
 * CS bugs are filed cross-product: nothing on the ticket says which
 * release caused it, so unlike product bugs they cannot be grouped by
 * project. What relates them to a release is *when* they arrived — a CS
 * bug reported while 3.36 was the version in production is 3.36's.
 *
 * A release owns production from its own go-live until the next
 * release's. Go-live comes from Linear's production release pipeline —
 * see content/release-go-live.ts for why nothing else serves, and in
 * particular why Testiny's regression runs do not: they are closed in
 * batches, so 3.35 and 3.36 share a close date and one of those two
 * windows would be zero days wide.
 *
 * Pure on purpose: no I/O, so the windowing is testable without keys.
 */

const DAY_MS = 86_400_000;

/** major.minor, however the version is written around it. */
const RELEASE_VERSION = /(\d+\.\d+)/;

export interface ReleaseWindow {
  /** "3.36" */
  release: string;
  rank: number;
  /** Regression close — the release is live in production from here. */
  liveAt: number;
  /** The next release's go-live, or `now` for the release in production. */
  endsAt: number;
  /** True while this is the release currently in production. */
  isCurrent: boolean;
}

/** A release and the moment it reached production. */
export interface GoLiveInput {
  release: string;
  /** ISO timestamp. */
  liveAt: string;
}

interface CsBugInput {
  createdAt?: string;
}

/** Midnight UTC, so a day bucket is a calendar day, not a 24h offset. */
function dayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * One production window per release, newest first.
 *
 * A release with no go-live date gets no window at all rather than a
 * guessed one: attributing a week of customer bugs to the wrong release
 * would look exactly like a real answer.
 */
export function buildReleaseWindows(
  goLive: GoLiveInput[],
  now: number,
): ReleaseWindow[] {
  const liveAtByRelease = new Map<string, number>();

  for (const entry of goLive) {
    const release = entry.release.match(RELEASE_VERSION)?.[1];
    if (!release) continue;
    const liveAt = Date.parse(entry.liveAt);
    if (Number.isNaN(liveAt)) continue;
    // Earliest wins: a version re-released keeps its first arrival in
    // front of customers.
    const known = liveAtByRelease.get(release);
    liveAtByRelease.set(
      release,
      known === undefined ? liveAt : Math.min(known, liveAt),
    );
  }

  const ordered = [...liveAtByRelease.entries()]
    .map(([release, liveAt]) => ({
      release,
      rank: versionRank(release) ?? 0,
      liveAt,
    }))
    // Chronological, not by version number: the window boundary is a date,
    // and a release shipped out of numeric order still owns its own week.
    .sort((a, b) => b.liveAt - a.liveAt);

  return ordered.map((entry, index) => ({
    ...entry,
    // index - 1 is the next release to ship after this one.
    endsAt: index === 0 ? now : ordered[index - 1].liveAt,
    isCurrent: index === 0,
  }));
}

/**
 * Cumulative CS bug curves, one per release window.
 *
 * Day 0 is go-live for every release, so the curves share a clock and
 * "week one of 3.36 versus week one of 3.35" is a straight comparison.
 * Each series is anchored at day 0 rather than at its first bug, which
 * gives the eye the baseline the product-bug chart gets from rebasing.
 * That anchor sits at zero unless a bug arrived on the go-live day
 * itself: buckets are calendar days, so a same-day report is part of
 * day 0 and the line starts at one. Pretending otherwise would put a
 * bug in a day it did not happen.
 *
 * `limit` caps the series count at the palette's validated slots.
 */
export function buildCsBugTrends(
  bugs: CsBugInput[],
  windows: ReleaseWindow[],
  limit = 7,
): ReleaseTrend[] {
  const created: number[] = [];
  for (const bug of bugs) {
    if (!bug.createdAt) continue;
    const t = Date.parse(bug.createdAt);
    if (!Number.isNaN(t)) created.push(t);
  }
  created.sort((a, b) => a - b);

  const trends: ReleaseTrend[] = [];

  for (const window of windows) {
    const inWindow = created.filter((t) => t >= window.liveAt && t < window.endsAt);

    const origin = dayStart(window.liveAt);
    const points: TrendPoint[] = [{ day: 0, count: 0 }];
    let count = 0;
    for (const t of inWindow) {
      count++;
      const offset = Math.max(0, Math.round((dayStart(t) - origin) / DAY_MS));
      const last = points[points.length - 1];
      if (last.day === offset) last.count = count;
      else points.push({ day: offset, count });
    }

    // Carry the line to the end of the window so a quiet tail reads as
    // quiet rather than as the release ending early.
    const span = Math.max(
      0,
      Math.round((dayStart(window.endsAt) - origin) / DAY_MS),
    );
    const last = points[points.length - 1];
    if (span > last.day) points.push({ day: span, count });

    trends.push({
      release: window.release,
      rank: window.rank,
      total: count,
      startedAt: new Date(window.liveAt).toISOString(),
      points,
    });
  }

  return trends.slice(0, limit);
}
