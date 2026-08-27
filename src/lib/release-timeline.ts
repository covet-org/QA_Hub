import type { RunSummary } from "@/lib/testiny/types";

/**
 * The steps a release goes through, dated against the process as it is
 * actually run:
 *
 *   Mon  dev testing starts, the moment the previous release's regression
 *        run is closed in Testiny — Monday through Wednesday
 *   Wed  sandbox testing starts, the moment the first issue is moved into
 *        the "N Release" project, and ends when the sandbox run is closed
 *   Fri  build moves to staging; regression starts when its run is created
 *        and ends when that run is closed
 *   Mon  release goes to production
 *
 * Phase boundaries are therefore *process events*, not execution stamps.
 * Two earlier anchors were wrong and are worth naming so they are not
 * tried again: the first `result_at` in the dev run is merely when
 * someone first saved a result (and it drifts forward when a case is
 * re-executed), and the release project's own `createdAt` is when the
 * container was made — for 3.37 that read Monday 04:33 PM against sandbox
 * testing that happened on the Wednesday. The first recorded result is
 * still shown, but as its own fact beneath the marker it follows.
 *
 * Execution stamps (`result_at`) still date the work itself. Never
 * `closed_at` for that: 3.36's dev and regression runs share the close
 * stamp 2026-08-24T19:09Z, three days after the last case ran. That same
 * batching is why the dev-start marker is checked rather than trusted — a
 * regression run closed a week late would date the next release's dev
 * phase to the wrong Monday, and `flags` says so when it happens.
 *
 * Pure: no I/O, so the ordering rules are testable without keys.
 */

export type MilestoneKey =
  | "dev-start"
  | "first-result"
  | "sandbox-start"
  | "sandbox-end"
  | "staging"
  | "regression-start"
  | "regression-end"
  | "released";

export interface Milestone {
  key: MilestoneKey;
  label: string;
  /** What dated it, for the row's tooltip. */
  source: string;
  /** ISO timestamp, or null when nothing in the data dates this step. */
  at: string | null;
  /** Why it is missing, when it is. Shown instead of a date. */
  pending: string | null;
  /** Hours since the previous dated milestone, when positive. */
  hoursFromPrevious: number | null;
}

export interface ReleaseTimeline {
  release: string;
  milestones: Milestone[];
  /**
   * Where this release departed from the process, or where the data
   * contradicts itself. Not errors — these are the "big moves" worth
   * seeing, so they are surfaced rather than smoothed away.
   */
  flags: string[];
  /** Days from the first dated milestone to the last. */
  spanDays: number | null;
}

export interface TimelineInput {
  release: string;
  dev: RunSummary | null;
  regression: RunSummary | null;
  /** The release before this one, for naming it in a flag. */
  previousRelease?: string | null;
  /** Its regression run's close — the marker that dev testing may start. */
  previousRegressionClosedAt?: string | null;
  /** First issue moved into the "N Release" project — sandbox starts. */
  issueArrivedAt?: string | null;
  /** Linear production pipeline: entered staging, and released. */
  stagingAt?: string | null;
  releasedAt?: string | null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Monday through Wednesday. Longer than this and the phase overran. */
const DEV_PHASE_DAYS = 3;

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function hours(from: number, to: number): number {
  return Math.round(((to - from) / HOUR_MS) * 10) / 10;
}

function days(from: number, to: number): number {
  return Math.round(((to - from) / DAY_MS) * 10) / 10;
}

function dayStamp(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function buildReleaseTimeline({
  release,
  dev,
  regression,
  previousRelease,
  previousRegressionClosedAt,
  issueArrivedAt,
  stagingAt,
  releasedAt,
}: TimelineInput): ReleaseTimeline {
  const devStart = parse(previousRegressionClosedAt);
  const firstResult = parse(dev?.firstResultAt);
  const sandboxStart = parse(issueArrivedAt);
  // Closing the sandbox run ends sandbox testing; creating the regression
  // run starts regression; closing it ends regression. The execution
  // stamps stay in play below, where they check these markers.
  const sandboxEnd = parse(dev?.closedAt);
  const regStart = parse(regression?.createdAt);
  const regEnd = parse(regression?.closedAt);
  const devLastRun = parse(dev?.lastResultAt);
  const regLastRun = parse(regression?.lastResultAt);
  const staging = parse(stagingAt);
  const released = parse(releasedAt);

  const previous = previousRelease ? `${previousRelease}'s` : "the previous";

  const raw: {
    key: MilestoneKey;
    label: string;
    source: string;
    at: number | null;
    pending: string | null;
  }[] = [
    {
      key: "dev-start",
      label: "Dev testing started",
      source: `${previous} regression run was closed in Testiny`,
      at: devStart,
      pending: previousRelease
        ? `${previousRelease}'s regression run is still open`
        : "no previous regression run",
    },
    {
      key: "first-result",
      label: "First recorded result",
      source: "earliest executed case in the dev/sandbox run",
      at: firstResult,
      pending: dev ? "nothing executed yet" : "no dev/sandbox run",
    },
    {
      key: "sandbox-start",
      label: "Sandbox testing started",
      source: `first issue moved into the "${release} Release" project`,
      at: sandboxStart,
      pending: `no issue moved into the "${release} Release" project yet`,
    },
    {
      key: "sandbox-end",
      label: "Sandbox testing closed",
      source: "the dev/sandbox run was closed in Testiny",
      at: sandboxEnd,
      pending: dev ? "sandbox run still open" : "no dev/sandbox run",
    },
    {
      key: "staging",
      label: "Moved to staging",
      source: "entered the Linear production release pipeline",
      at: staging,
      pending: "not in the release pipeline yet",
    },
    {
      key: "regression-start",
      label: "Regression started",
      source: "the regression run was created in Testiny",
      at: regStart,
      pending: "no regression run yet",
    },
    {
      key: "regression-end",
      label: "Regression finished",
      source: "the regression run was closed in Testiny",
      at: regEnd,
      pending: regression
        ? "regression run still open"
        : "no regression run yet",
    },
    {
      key: "released",
      label: "Released to production",
      source: "reached the released stage of the production pipeline",
      at: released,
      pending: "not released yet",
    },
  ];

  // Gaps run between dated milestones only, so one missing step does not
  // silently attribute its time to the next one. Only forward gaps get a
  // number — a step dated before the one above it reads as no gap rather
  // than as negative time, and earns a flag instead.
  let prior: number | null = null;
  const milestones: Milestone[] = raw.map((m) => {
    const gap =
      m.at !== null && prior !== null && m.at > prior
        ? hours(prior, m.at)
        : null;
    if (m.at !== null) prior = m.at;
    return {
      key: m.key,
      label: m.label,
      source: m.source,
      at: m.at === null ? null : new Date(m.at).toISOString(),
      pending: m.at === null ? m.pending : null,
      hoursFromPrevious: gap,
    };
  });

  const flags: string[] = [];

  // The dev-start marker is only as good as the habit of closing runs on
  // time. Work recorded before the marker means the close was retroactive
  // and this date is fiction — the most important thing to say here.
  if (devStart !== null && firstResult !== null && firstResult < devStart) {
    flags.push(
      `dev testing was recorded from ${dayStamp(firstResult)}, before ${previous} regression run was closed on ${dayStamp(devStart)} — that close is retroactive, so the dev start above is not reliable`,
    );
  }

  // Dev is Monday to Wednesday; sandbox opens on the Thursday.
  if (devStart !== null && sandboxStart !== null) {
    const span = days(devStart, sandboxStart);
    if (span > DEV_PHASE_DAYS + 0.5) {
      flags.push(
        `dev testing ran ${span}d before sandbox opened — the process allows Monday to Wednesday`,
      );
    }
  }

  // A sandbox phase closed before any issue arrived in it never ran.
  if (
    sandboxStart !== null &&
    sandboxEnd !== null &&
    sandboxEnd < sandboxStart
  ) {
    flags.push(
      `the sandbox run was closed before the first issue reached the ${release} Release project — the sandbox phase did not run`,
    );
  }

  // Runs left open long after the work stopped. This is what makes the
  // markers drift: the close is the process signal, so a run shut days
  // late reports a phase that ended days late, and gates the NEXT
  // release's dev start on a date nobody worked on.
  if (sandboxEnd !== null && devLastRun !== null) {
    const late = days(devLastRun, sandboxEnd);
    if (late > 1) {
      flags.push(
        `the sandbox run was closed ${late}d after its last case was executed`,
      );
    }
  }
  if (regEnd !== null && regLastRun !== null) {
    const late = days(regLastRun, regEnd);
    if (late > 1) {
      flags.push(
        `the regression run was closed ${late}d after its last case was executed`,
      );
    }
  }

  // Phases running at the same time. Measured on executions, not on the
  // markers: a run staying open past regression is bookkeeping, whereas a
  // case executed in the sandbox after regression began is real overlap.
  if (regStart !== null && devLastRun !== null && devLastRun > regStart) {
    flags.push(
      `sandbox cases were still being executed ${hours(regStart, devLastRun)}h after regression started`,
    );
  }

  if (staging !== null && devLastRun !== null && devLastRun > staging) {
    flags.push(
      `sandbox cases were still being executed ${hours(staging, devLastRun)}h after the staging move`,
    );
  }

  if (released !== null && regLastRun !== null && regLastRun > released) {
    flags.push("regression cases were executed after the release went out");
  }

  const dated = milestones
    .map((m) => parse(m.at))
    .filter((t): t is number => t !== null);
  const spanDays =
    dated.length > 1 ? days(Math.min(...dated), Math.max(...dated)) : null;

  return { release, milestones, flags, spanDays };
}
