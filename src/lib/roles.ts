import { env } from "@/lib/env";

/**
 * Role model
 * ──────────
 * viewer — anyone signed in with an allowed-domain Google account.
 * qa     — QA team members (QA_TEAM_EMAILS). Unlocks testing sections.
 * admin  — QA leads (QA_ADMIN_EMAILS). Unlocks everything, incl. Access page.
 *
 * Roles are hierarchical: admin ⊃ qa ⊃ viewer.
 */
export type Role = "viewer" | "qa" | "admin";

const ROLE_RANK: Record<Role, number> = { viewer: 0, qa: 1, admin: 2 };

export function roleForEmail(email: string | null | undefined): Role {
  if (!email) return "viewer";
  const normalized = email.toLowerCase();
  if (env.adminEmails.includes(normalized)) return "admin";
  if (env.qaTeamEmails.includes(normalized)) return "qa";
  return "viewer";
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${env.allowedEmailDomain}`);
}
