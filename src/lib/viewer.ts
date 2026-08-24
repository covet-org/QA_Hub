import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { navigation } from "@/config/navigation";
import { memberFor, type AccessStatus } from "@/lib/access/members";
import { hasRole, type Role } from "@/lib/roles";

export interface Viewer {
  email: string;
  name: string;
  role: Role;
  status: AccessStatus;
}

/**
 * Who is looking at the page. Signed-in members only — share links went
 * away with the KV store, so there are no guests.
 *
 * Resolved from the session plus env configuration alone, so no request
 * can fail because a database is unreachable. That failure mode is what
 * showed the whole team "Access Denied".
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const member = memberFor(session.user.email);
  return {
    email: member.email,
    name: session.user.name ?? member.email,
    role: member.role,
    status: member.status,
  };
}

/** Hrefs this viewer may open (single source of truth: navigation config). */
export function allowedHrefs(viewer: Viewer): string[] {
  if (viewer.status === "blocked") return [];
  return navigation
    .flatMap((s) => s.items)
    .filter((i) => hasRole(viewer.role, i.minRole))
    .map((i) => i.href);
}

/**
 * Server-side gate used by every page: no session → sign-in, blocked →
 * the no-access page, a section above your role → back to what you can
 * see.
 */
export async function requireAccess(href: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.status === "blocked") redirect("/no-access");

  const allowed = allowedHrefs(viewer);
  if (!allowed.includes(href)) redirect("/?denied=1");
  return viewer;
}
