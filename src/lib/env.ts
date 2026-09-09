/**
 * Central, validated access to environment variables.
 * Import from here instead of reading process.env directly so that
 * missing configuration fails loudly in one place.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

function emailList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  get allowedEmailDomain(): string {
    return (process.env.ALLOWED_EMAIL_DOMAIN ?? "co.vet").toLowerCase();
  },
  get adminEmails(): string[] {
    return emailList("QA_ADMIN_EMAILS");
  },
  get qaTeamEmails(): string[] {
    return emailList("QA_TEAM_EMAILS");
  },
  /** Demoted to viewer: signed in, but no testing sections. */
  get viewerEmails(): string[] {
    return emailList("QA_VIEWER_EMAILS");
  },
  /** Refused outright, even on the allowed domain. */
  get blockedEmails(): string[] {
    return emailList("QA_BLOCKED_EMAILS");
  },
  get testinyApiKey(): string | undefined {
    return process.env.TESTINY_API_KEY || undefined;
  },
  get testinyProjectId(): number {
    return Number(process.env.TESTINY_PROJECT_ID ?? "1");
  },
  get linearApiKey(): string | undefined {
    return process.env.LINEAR_API_KEY || undefined;
  },
  /** Linear labels that put a ticket on the QA roadmap. */
  get roadmapLabels(): string[] {
    return (
      process.env.QA_ROADMAP_LABELS ?? "Medium to Big Size Features,Quick wins"
    )
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  },
  /** Tickets carrying any of these labels never appear on the roadmap
   *  (QA's own process tickets, e.g. "QA Test Design | COV-x"). */
  get roadmapExcludeLabels(): string[] {
    return (process.env.QA_ROADMAP_EXCLUDE_LABELS ?? "qa")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  },
  /** Linear label marking product bugs. */
  get bugLabel(): string {
    return process.env.QA_BUG_LABEL ?? "Bug";
  },
  /** Linear label marking customer-support bugs. */
  get csBugLabel(): string {
    return process.env.QA_CS_BUG_LABEL ?? "CS Bug";
  },
  /**
   * Require a story label before release work counts as a story.
   *
   * Off by default, and that default is load-bearing: release projects
   * hold REL-* tickets labelled "Bug", "3.37", "Sandbox" or nothing, and
   * none carry the two feature labels — turning this on today empties the
   * release panels. Flip it once release tickets are labelled.
   */
  get releaseRequireStoryLabel(): boolean {
    return process.env.QA_RELEASE_REQUIRE_STORY_LABEL === "true";
  },
  /** Linear label marking bugs found in regression. */
  get regressionBugLabel(): string {
    return process.env.QA_REGRESSION_BUG_LABEL ?? "Regression";
  },
  /**
   * The group the Roadmap board opens on. Not shared with the sign-off
   * project setting even though both name Squad 4 today: one is "where the
   * gate looks", the other "what the board opens on", and tying them means
   * moving one silently moves the other.
   */
  get roadmapDefaultGroup(): string {
    return process.env.QA_ROADMAP_DEFAULT_GROUP ?? "Squad 4 - Cross-Product";
  },
  /** Linear project the design sign-off gate watches. */
  get signOffProject(): string {
    return process.env.QA_SIGNOFF_PROJECT ?? "Squad 4 - Cross-Product";
  },
  /** Labels that put a story under the sign-off gate. */
  get signOffLabels(): string[] {
    return (
      process.env.QA_SIGNOFF_LABELS ?? "Medium to Big Size Features,Quick wins"
    )
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  },
  /** The Linear status that means the story reached dev. */
  get signOffMergedStatus(): string {
    return process.env.QA_SIGNOFF_MERGED_STATUS ?? "Merged to dev";
  },
  /**
   * Slack channel whose threads count as written confirmation. Matched by
   * id because that is what Linear puts in the attachment URL; the name is
   * carried separately for the copy.
   */
  get signOffSlackChannelId(): string {
    return process.env.QA_SIGNOFF_SLACK_CHANNEL_ID ?? "C0ADVLJBUCE";
  },
  get signOffSlackChannelName(): string {
    return process.env.QA_SIGNOFF_SLACK_CHANNEL_NAME ?? "4-squad-cross-product";
  },
  /**
   * When the Slack-to-Linear sync began. A story merged before this cannot
   * carry a linked thread however well it was presented, so it is reported
   * as predating the sync rather than as a missing sign-off.
   */
  get signOffSyncSince(): string {
    return process.env.QA_SIGNOFF_SYNC_SINCE ?? "2026-08-27";
  },
  /**
   * Phrases in a linked Slack message that make it a merge confirmation
   * rather than someone tagging the ticket. Past tense on purpose: a bare
   * "merge" also appears in "don't merge yet".
   */
  get signOffConfirmPhrases(): string[] {
    return (
      process.env.QA_SIGNOFF_CONFIRM_PHRASES ??
      "merged,merged to dev,are merged,mergeado,mergeada"
    )
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  },
  /** Where access-request notifications are sent. */
  get notifyEmail(): string {
    return process.env.NOTIFY_EMAIL ?? "clezama@co.vet";
  },
  /** Public base URL, used in email links. */
  get appUrl(): string {
    return (
      process.env.APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
    );
  },
  /** Only call at runtime inside auth — required() throws if unset. */
  get authGoogleId(): string {
    return required("AUTH_GOOGLE_ID");
  },
  get authGoogleSecret(): string {
    return required("AUTH_GOOGLE_SECRET");
  },
};
