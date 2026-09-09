/**
 * What counts as a story, and what counts as a bug, in a release detail.
 *
 * The shape of the data decides this, and it is not what the label names
 * suggest. A release project holds REL-* tickets labelled "Bug", "3.37",
 * "Sandbox", "UI fix" — or nothing at all. Checked against 3.37: ZERO of
 * its issues carry "Medium to Big Size Features" or "Quick wins". Those
 * two labels live on the COV-* roadmap tickets in the squad projects, not
 * on the release work itself.
 *
 * So requiring a story label of release-project work empties the board.
 * The noise a release detail actually needs to lose is QA's own process
 * tickets — "QA Test Design | COV-7309", "QA Review", "Gabriel review" —
 * which is a title convention the roadmap query already filters on. That
 * is the rule here, with the label requirement available as a switch for
 * when release work does get labelled (QA_RELEASE_REQUIRE_STORY_LABEL).
 *
 * Precedence: a story label BEATS a bug label. A ticket marked both
 * "Quick wins" and "Bug" is a quick win — it is planned work that happens
 * to have been raised as a bug — and it is dropped from the bug list so
 * it is counted once, not twice.
 *
 * Pure and list-driven, so the rule is testable and the labels stay
 * configurable.
 */

export interface LabelRules {
  /** Labels marking planned feature work. */
  storyLabels: string[];
  /** Labels marking bugs. */
  bugLabels: string[];
  /** Labels marking QA's own process tickets, e.g. ["qa"]. */
  excludeLabels: string[];
  /**
   * Require a story label before a ticket counts as a story.
   *
   * Off by default: release projects do not label their work today, and
   * with this on the release panels show nothing at all. Turn it on once
   * release tickets carry the labels, and unlabelled work will drop out.
   */
  requireStoryLabel: boolean;
}

/** Case-insensitive, because Linear label casing is not enforced. */
function has(labels: string[], wanted: string[]): boolean {
  const set = new Set(wanted.map((l) => l.trim().toLowerCase()));
  return labels.some((l) => set.has(l.trim().toLowerCase()));
}

/**
 * QA's own process tickets, which are not release content.
 *
 * Two conventions, both live in 3.37: "QA <phase> | ..." at the start of
 * the title, and sign-off tickets whose title ends in "review" ("QA
 * Review", "Francisco Review", "Gabriel review"). The label check catches
 * the ones that are tagged properly.
 */
export function isProcessTicket(
  title: string,
  labels: string[],
  excludeLabels: string[],
): boolean {
  if (/^QA\b/i.test(title)) return true;
  if (/\breview\s*$/i.test(title)) return true;
  return has(labels, excludeLabels);
}

/**
 * A story: release content that is not a bug and not process overhead.
 *
 * A story label always wins, even against a bug label — that is the
 * "Quick wins + Bug counts as the quick win" rule.
 */
export function isReleaseStory(
  title: string,
  labels: string[],
  rules: LabelRules,
): boolean {
  if (isProcessTicket(title, labels, rules.excludeLabels)) return false;
  if (has(labels, rules.storyLabels)) return true;
  if (rules.requireStoryLabel) return false;
  // Unlabelled release work still shipped in this release, so it belongs
  // on the list; only bugs are held back, because they have their own.
  return !has(labels, rules.bugLabels);
}

/**
 * A bug: carries a bug label and is NOT claimed by a story label.
 *
 * The second half is what stops a "Quick wins + Bug" ticket appearing in
 * both lists of the same release panel.
 */
export function isReleaseBug(labels: string[], rules: LabelRules): boolean {
  if (has(labels, rules.storyLabels)) return false;
  return has(labels, rules.bugLabels);
}
