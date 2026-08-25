import "server-only";

import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { isAllowedEmail, roleForEmail, type Role } from "@/lib/roles";

/**
 * Access policy — configuration only, no database.
 *
 * The domain IS the allowlist: any verified Google account on
 * ALLOWED_EMAIL_DOMAIN gets in as `qa`. Three env lists adjust that:
 *
 *   QA_ADMIN_EMAILS   — full access incl. the Access page
 *   QA_VIEWER_EMAILS  — demoted: no testing sections
 *   QA_BLOCKED_EMAILS — refused outright
 *
 * There is deliberately no KV store. Access used to depend on Upstash,
 * and when Upstash went down every sign-in threw inside the Auth.js
 * callback and the whole team saw "Access Denied". Configuration cannot
 * have an outage.
 *
 * The cost, accepted knowingly: changing someone's role means editing the
 * env vars and redeploying (about a minute) rather than clicking on
 * /access, which is now a read-only view of this policy.
 */

export type AccessStatus = "approved" | "blocked";

export interface Member {
  email: string;
  role: Role;
  status: AccessStatus;
}

export function isAdminEmail(email: string): boolean {
  return env.adminEmails.includes(email.trim().toLowerCase());
}

export function isBlockedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.blockedEmails.includes(email.trim().toLowerCase());
}

/** Resolve a signed-in address to its role and status. */
export function memberFor(email: string): Member {
  const normalized = email.trim().toLowerCase();
  if (isBlockedEmail(normalized)) {
    return { email: normalized, role: "viewer", status: "blocked" };
  }
  return {
    email: normalized,
    role: roleForEmail(normalized),
    status: isAllowedEmail(normalized) ? "approved" : "blocked",
  };
}

/**
 * Tells the QA lead somebody signed in.
 *
 * Without a store there is no way to know whether this is a person's
 * first ever sign-in, so this fires on each new session rather than once
 * per person. Sessions last 30 days, so it stays occasional.
 *
 * Never throws: a mail failure must not stop somebody signing in.
 */
export async function notifySignIn(email: string, name: string): Promise<void> {
  const member = memberFor(email);
  const roleLabel =
    member.role === "admin"
      ? "admin"
      : member.role === "qa"
        ? "QA team"
        : "viewer";

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
    <p style="font-size:18px;font-weight:700;color:#0b4a60;margin:0">co·vet <span style="font-weight:400;color:#64748b">QA Hub</span></p>
    <h2 style="font-size:16px;color:#0f172a">Sign-in</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6">
      <strong>${name || email}</strong> (${email}) signed in to QA Hub as
      <strong>${roleLabel}</strong>, admitted automatically because the
      address is on the ${env.allowedEmailDomain} domain.
    </p>
    <p style="font-size:13px;color:#334155;line-height:1.6">
      No action needed. Roles are set in the environment variables
      QA_ADMIN_EMAILS, QA_VIEWER_EMAILS and QA_BLOCKED_EMAILS — see the
      <a href="${env.appUrl}/access" style="color:#0f5a74">Access page</a>.
    </p>
  </div>`;

  try {
    await sendEmail({
      to: env.notifyEmail,
      subject: `QA Hub — ${name || email} signed in`,
      html,
    });
  } catch (error) {
    console.error(
      `Sign-in notification failed for ${email}: ${error instanceof Error ? error.message : error}`,
    );
  }
}
