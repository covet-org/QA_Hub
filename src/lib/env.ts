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
