/**
 * When each release actually reached production.
 *
 * Why this file exists at all: nothing QA Hub already reads knows the
 * date. Linear's release *projects* ("3.36 Release") carry no dates —
 * startDate, targetDate and completedAt are all null and every one sits
 * in Backlog. Testiny's regression runs looked like the answer and are
 * not: they get closed administratively, in batches. 3.33 and 3.34 were
 * both closed on 2026-08-12, and 3.35 and 3.36 both on 2026-08-24, which
 * makes two of those four windows zero days wide.
 *
 * The real source is Linear's production release pipeline (Settings →
 * Releases, pipeline "Staging", flagged isProduction). Each version there
 * has a startedAt — when it entered the pipeline, a Friday — and a
 * completedAt, when it reached the "Released" stage. The completedAt
 * dates below are every one a Monday, exactly seven days apart, which is
 * the "next Monday the release goes live" cadence QA describes.
 *
 * `fetchProductionReleases()` reads that pipeline live; this table is the
 * fallback for when it cannot (the API surface is newer than the rest of
 * what we query) and the record for releases older than the pipeline.
 *
 * TO UPDATE when a release ships: add its version and the completedAt of
 * its release in the production pipeline. If the live query works, you
 * will never need to — check the "CS bugs per release" card: it names its
 * source.
 */
export const RELEASE_GO_LIVE: Record<string, string> = {
  "3.33": "2026-08-03T20:12:00.000Z",
  "3.34": "2026-08-10T18:20:18.761Z",
  "3.35": "2026-08-17T15:53:07.379Z",
  "3.36": "2026-08-24T15:07:08.088Z",
};
