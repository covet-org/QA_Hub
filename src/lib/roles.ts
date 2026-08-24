import { env } from "@/lib/env";

/**
 * Role model
 * ──────────
 * qa     — DEFAULT for anyone signed in on the allowed domain. Unlocks
 *          every section except the admin Access page.
 * admin  — QA leads (QA_ADMIN_EMAILS). Unlocks everything, incl. Access.
 * viewer — restricted: Home, Roadmap, Releases, Bugs, but not the
 *          testing sections. Only ever assigned deliberately on /access,
 *          never the default, since the domain is the allowlist.
 *
 * Roles are hierarchical: admin ⊃ qa ⊃ viewer.
 */
export type Role = "viewer" | "qa" | "admin";

const ROLE_RANK: Record<Role, number> = { viewer: 0, qa: 1, admin: 2 };

export function roleForEmail(email: string | null | undefined): Role {
  // No email means no session at all; nothing is unlocked by "viewer".
  if (!email) return "viewer";
  const normalized = email.toLowerCase();
  if (env.adminEmails.includes(normalized)) return "admin";
  // Everyone on the domain is QA team by default. QA_TEAM_EMAILS is kept
  // for explicitness but no longer decides anything on its own.
  return isAllowedEmail(normalized) || env.qaTeamEmails.includes(normalized)
    ? "qa"
    : "viewer";
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // Normalize the configured domain too: a stray "@", capitals or
  // whitespace in ALLOWED_EMAIL_DOMAIN would otherwise reject every
  // legitimate address, and that failure looks identical to a real
  // rejection.
  const domain = env.allowedEmailDomain.trim().toLowerCase().replace(/^@/, "");
  if (!domain) return false;
  return email.trim().toLowerCase().endsWith(`@${domain}`);
}
