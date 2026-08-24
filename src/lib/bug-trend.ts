import { RELEASE_NAME, versionRank } from "./release-utils";

/**
 * Bug discovery curves, one per release.
 *
 * A release's line is the cumulative count of bugs filed against it,
 * plotted against days since its FIRST bug rather than a calendar date.
 * Releases start on different days, so a shared calendar axis would push
 * them apart and make the shapes incomparable; day-since-first puts them
 * on top of each other, which is the actual question — "are we finding
 * more bugs this release, and faster?"
 *
 * Pure on purpose: no I/O, so the maths is testable without an API key.
 */

export interface TrendPoint {
  /** Days since this release's first bug. */
  day: number;
  /** Cumulative bugs filed by the end of that day. */
  count: number;
}

export interface ReleaseTrend {
  /** "3.36" */
  release: string;
  rank: number;
  total: number;
  /** ISO date of the first bug, for the tooltip. */
  startedAt: string;
  points: TrendPoint[];
}

interface TrendInput {
  project: string | null;
  createdAt?: string;
}

const DAY_MS = 86_400_000;

/** Midnight UTC, so a day bucket is a calendar day and not a 24h offset. */
function dayStart(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? NaN : Math.floor(t / DAY_MS) * DAY_MS;
}

/**
 * Build one cumulative curve per release, newest release first.
 *
 * `limit` caps how many releases come back — the chart offers at most 7,
 * because an 8th categorical hue would have to be invented and the
 * palette only has seven validated slots.
 */
export function buildBugTrends(
  bugs: TrendInput[],
  limit = 7,
): ReleaseTrend[] {
  const byRelease = new Map<string, number[]>();

  for (const bug of bugs) {
    if (!bug.project || !RELEASE_NAME.test(bug.project)) continue;
    if (!bug.createdAt) continue;
    const day = dayStart(bug.createdAt);
    if (Number.isNaN(day)) continue;
    const release = bug.project.match(/(\d+\.\d+)/)?.[1];
    if (!release) continue;
    byRelease.set(release, [...(byRelease.get(release) ?? []), day]);
  }

  const trends: ReleaseTrend[] = [];
  for (const [release, days] of byRelease) {
    const sorted = [...days].sort((a, b) => a - b);
    const first = sorted[0];

    // One point per day that actually saw bugs; a flat stretch between
    // two points is a stretch where nothing was found, which the line
    // shows correctly without emitting a point per empty day.
    const points: TrendPoint[] = [];
    let count = 0;
    for (const day of sorted) {
      count++;
      const offset = Math.round((day - first) / DAY_MS);
      const last = points[points.length - 1];
      if (last && last.day === offset) last.count = count;
      else points.push({ day: offset, count });
    }

    trends.push({
      release,
      rank: versionRank(release) ?? 0,
      total: count,
      startedAt: new Date(first).toISOString(),
      points,
    });
  }

  return trends
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);
}
