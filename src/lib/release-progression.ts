import type { RunSummary } from "@/lib/testiny/types";

/**
 * Which release to show on Home, and its runs split by phase.
 *
 * A release is tested in two runs sharing one number — "3.36 Dev/Sandbox"
 * and "Regression 3.36" — so a progression card for a release means both
 * of them, not whichever one happens to sort first.
 *
 * Pure: the picking rules are the part worth being sure about, and they
 * are testable without Testiny.
 */

/** major.minor, wherever it sits in a run title. */
const VERSION = /(\d+\.\d+)/;

/** "Regression 3.36", "3.35 Regresion" — the typo is in the real data. */
const REGRESSION = /regres+ion/i;

/** The release a run title names, or null when it names none. */
export function releaseOfRun(title: string): string | null {
  return title.match(VERSION)?.[1] ?? null;
}

/** Regression rather than dev/sandbox. Shared so one rule decides. */
export function isRegressionRun(title: string): boolean {
  return REGRESSION.test(title);
}

export interface ReleaseProgression {
  /** "3.36" */
  release: string;
  /** True when this release still has an open run. */
  isActive: boolean;
  /** Both phases, either of which may be missing. */
  dev: RunSummary | null;
  regression: RunSummary | null;
}

function versionRank(release: string): number {
  const [major, minor] = release.split(".");
  return Number(major) * 1000 + Number(minor);
}

/**
 * The release in flight, or the last one that shipped.
 *
 * Active runs win: that is what QA is doing right now. With none open,
 * the newest closed release is the honest answer to "where are we" —
 * blank space would just look broken.
 */
export function pickReleaseProgression(
  activeRuns: RunSummary[],
  closedRuns: RunSummary[],
): ReleaseProgression | null {
  const fromActive = latestRelease(activeRuns);
  if (fromActive) return { ...fromActive, isActive: true };

  const fromClosed = latestRelease(closedRuns);
  if (fromClosed) return { ...fromClosed, isActive: false };

  return null;
}

function latestRelease(
  runs: RunSummary[],
): Omit<ReleaseProgression, "isActive"> | null {
  const byRelease = new Map<string, RunSummary[]>();
  for (const run of runs) {
    const release = run.title.match(VERSION)?.[1];
    if (!release) continue;
    byRelease.set(release, [...(byRelease.get(release) ?? []), run]);
  }
  if (byRelease.size === 0) return null;

  const release = [...byRelease.keys()].sort(
    (a, b) => versionRank(b) - versionRank(a),
  )[0];
  const runsForRelease = byRelease.get(release)!;

  return {
    release,
    // Phase from the title, the same rule the release testing card and
    // the CS windows use. A release with two dev runs keeps the newest;
    // Testiny ids increase over time.
    regression: newest(runsForRelease.filter((r) => REGRESSION.test(r.title))),
    dev: newest(runsForRelease.filter((r) => !REGRESSION.test(r.title))),
  };
}

function newest(runs: RunSummary[]): RunSummary | null {
  if (runs.length === 0) return null;
  return runs.reduce((latest, run) => (run.id > latest.id ? run : latest));
}

export interface CurrentPhase {
  label: string;
  run: RunSummary;
}

/**
 * The phase the release is actually in.
 *
 * Dev and regression DO overlap — 3.36's sandbox run had cases executed
 * 4.1h after regression started, 3.35's ran on for about nineteen. So one
 * number is a choice, not a consequence: regression wins as soon as it has
 * a single executed case, because once regression is under way the dev
 * percentage stops being the news even while it keeps moving. Before that
 * it is dev.
 *
 * The overlap itself is shown, not hidden — see the release timeline on the
 * run cards, which flags it rather than smoothing it into clean phases.
 *
 * Which phase a percentage belongs to is not decoration: 8% of dev and
 * 8% of regression are opposite ends of a release.
 */
export function currentPhase(
  progression: ReleaseProgression,
): CurrentPhase | null {
  const { dev, regression } = progression;
  const started = (run: RunSummary | null) =>
    run !== null && run.total - run.notRun > 0;

  if (started(regression)) return { label: "Regression", run: regression! };
  if (dev) return { label: "Dev / Sandbox", run: dev };
  if (regression) return { label: "Regression", run: regression };
  return null;
}
