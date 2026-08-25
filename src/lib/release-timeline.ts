import type { RunSummary } from "@/lib/testiny/types";

/**
 * The steps a release goes through, dated from what actually happened.
 *
 * Built from execution timestamps (`result_at` on each case), not from run
 * open/close dates. Runs are closed in batches: 3.36's dev and regression
 * runs share the close stamp 2026-08-24T19:09Z, three days after the last
 * case ran, and 3.34 Dev and 3.35 Dev share another. A timeline drawn from
 * `closed_at` would say every release finished on the same afternoon.
 *
 * Deliberately a list of *events*, not a set of phase durations. In the
 * real data the phases interleave — 3.36's sandbox run had cases executed
 * at 18:19 on the 21st, four hours after regression had started, and
 * 3.35's overlapped by nineteen hours. Modelling this as clean
 * back-to-back phases would have to either lie or produce negative
 * durations, so it reports what is dated and flags what is out of order.
 *
 * Pure: no I/O, so the ordering rules are testable without keys.
 */

export type MilestoneKey =
  | "sandbox-start"
  | "sandbox-end"
  | "staging"
  | "regression-start"
  | "regression-end"
  | "released";

export interface Milestone {
  key: MilestoneKey;
  label: string;
  /** ISO timestamp, or null when nothing in the data dates this step. */
  at: string | null;
  /** Why it is missing, when it is. Shown instead of a date. */
  pending: string | null;
  /** Working hours since the previous dated milestone, when positive. */
  hoursFromPrevious: number | null;
}

export interface ReleaseTimeline {
  release: string;
  milestones: Milestone[];
  /**
   * Steps whose dates arrived out of the expected order. Not an error in
   * the data — a real overlap in how the release ran — and worth surfacing
   * rather than smoothing away.
   */
  overlaps: string[];
  /** Days from the first dated milestone to the last. */
  spanDays: number | null;
}

export interface TimelineInput {
  release: string;
  dev: RunSummary | null;
  regression: RunSummary | null;
  /** Linear production pipeline: entered staging, and released. */
  stagingAt?: string | null;
  releasedAt?: string | null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

export function buildReleaseTimeline({
  release,
  dev,
  regression,
  stagingAt,
  releasedAt,
}: TimelineInput): ReleaseTimeline {
  const devStart = parse(dev?.firstResultAt);
  const devEnd = parse(dev?.lastResultAt);
  const regStart = parse(regression?.firstResultAt);
  const regEnd = parse(regression?.lastResultAt);
  const staging = parse(stagingAt);
  const released = parse(releasedAt);

  const raw: { key: MilestoneKey; label: string; at: number | null; pending: string | null }[] = [
    {
      key: "sandbox-start",
      label: "Testing started in sandbox",
      at: devStart,
      pending: dev ? "no cases executed yet" : "no sandbox run",
    },
    {
      key: "sandbox-end",
      label: "Last sandbox execution",
      at: devEnd,
      pending: dev ? "not started" : "no sandbox run",
    },
    {
      key: "staging",
      label: "Moved to staging",
      at: staging,
      pending: "not in the release pipeline yet",
    },
    {
      key: "regression-start",
      label: "Regression started",
      at: regStart,
      pending: regression ? "not started" : "no regression run yet",
    },
    {
      key: "regression-end",
      label: "Regression finished",
      at: regEnd,
      pending: regression ? "in progress" : "no regression run yet",
    },
    {
      key: "released",
      label: "Released to production",
      at: released,
      pending: "not released yet",
    },
  ];

  // Gaps run between dated milestones only, so one missing step does not
  // silently attribute its time to the next one.
  let previous: number | null = null;
  const milestones: Milestone[] = raw.map((m) => {
    const hours =
      m.at !== null && previous !== null && m.at > previous
        ? Math.round(((m.at - previous) / HOUR_MS) * 10) / 10
        : null;
    if (m.at !== null) previous = m.at;
    return {
      key: m.key,
      label: m.label,
      at: m.at === null ? null : new Date(m.at).toISOString(),
      pending: m.at === null ? m.pending : null,
      hoursFromPrevious: hours,
    };
  });

  const overlaps: string[] = [];
  if (regStart !== null && devEnd !== null && devEnd > regStart) {
    const hours = Math.round(((devEnd - regStart) / HOUR_MS) * 10) / 10;
    overlaps.push(
      `sandbox testing continued ${hours}h after regression started`,
    );
  }
  if (staging !== null && devEnd !== null && devEnd > staging) {
    const hours = Math.round(((devEnd - staging) / HOUR_MS) * 10) / 10;
    overlaps.push(`sandbox testing continued ${hours}h after the staging move`);
  }
  if (released !== null && regEnd !== null && regEnd > released) {
    overlaps.push("regression finished after the release went out");
  }

  const dated = milestones
    .map((m) => parse(m.at))
    .filter((t): t is number => t !== null);
  const spanDays =
    dated.length > 1
      ? Math.round(
          ((Math.max(...dated) - Math.min(...dated)) / DAY_MS) * 10,
        ) / 10
      : null;

  return { release, milestones, overlaps, spanDays };
}
