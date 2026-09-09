/**
 * What counts as a tracked item in a release.
 *
 * A release detail lists two kinds of work and nothing else: features
 * (Medium to Big Size Features, Quick wins) and bugs (Bug, CS Bug).
 * Anything in a release project carrying none of those labels — a chore, a
 * spike, a container ticket, a stray sub-task — is not a user story and
 * must not be listed as one.
 *
 * That was the bug this replaces: the filter only excluded bugs, so every
 * unlabelled ticket in the project fell through and rendered as a feature,
 * inflating both the release panels and Home's feature counts with work
 * nobody tracks.
 *
 * Pure and list-driven, so the labels stay configurable and one rule
 * decides for every surface.
 */

/** Case-insensitive, because Linear label casing is not enforced. */
function has(labels: string[], wanted: string[]): boolean {
  const set = new Set(wanted.map((l) => l.trim().toLowerCase()));
  return labels.some((l) => set.has(l.trim().toLowerCase()));
}

/**
 * A feature: carries a story label and is not a bug.
 *
 * Bugs are checked first and excluded outright — a ticket labelled both
 * "Quick wins" and "Bug" is a bug, and it already has its own list in the
 * panel. Counting it in both would double it.
 */
export function isReleaseStory(
  labels: string[],
  storyLabels: string[],
  bugLabels: string[],
): boolean {
  if (has(labels, bugLabels)) return false;
  return has(labels, storyLabels);
}

/** A bug, by the labels the bug boards are built from. */
export function isReleaseBug(labels: string[], bugLabels: string[]): boolean {
  return has(labels, bugLabels);
}
