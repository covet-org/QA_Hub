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
  get testinyApiKey(): string | undefined {
    return process.env.TESTINY_API_KEY || undefined;
  },
  get testinyProjectId(): number {
    return Number(process.env.TESTINY_PROJECT_ID ?? "1");
  },
  /** Only call at runtime inside auth — required() throws if unset. */
  get authGoogleId(): string {
    return required("AUTH_GOOGLE_ID");
  },
  get authGoogleSecret(): string {
    return required("AUTH_GOOGLE_SECRET");
  },
};
