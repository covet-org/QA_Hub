import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { navigation } from "@/config/navigation";
import { getValidShareLink } from "@/lib/access/links";
import {
  getAccessRecord,
  isAdminEmail,
  type AccessStatus,
} from "@/lib/access/requests";
import { verifyToken } from "@/lib/access/token";
import { hasRole, roleForEmail, type Role } from "@/lib/roles";

/** Cookie carrying the signed share-link grant for guests. */
export const SHARE_COOKIE = "qa_share";

export type Viewer =
  | {
      kind: "member";
      email: string;
      name: string;
      role: Role;
      status: AccessStatus;
    }
  | {
      kind: "guest";
      linkId: string;
      label: string;
      sections: string[];
    };

/**
 * Resolve who is looking at the page: a signed-in member (Google SSO,
 * approval-gated) or a guest holding a valid share-link cookie.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (session?.user?.email) {
    const email = session.user.email;
    if (isAdminEmail(email)) {
      return {
        kind: "member",
        email,
        name: session.user.name ?? email,
        role: "admin",
        status: "approved",
      };
    }
    // The domain is the allowlist, so a member is approved unless a
    // record explicitly denies them. A missing record — first request
    // after sign-in, or an unreachable store — must not read as pending:
    // that is what was rejecting people with valid co.vet accounts.
    const record = await getAccessRecord(email).catch((error) => {
      console.error(
        `Access record unreadable for ${email}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    });
    return {
      kind: "member",
      email,
      name: session.user.name ?? email,
      role: record?.status === "approved" ? record.role : roleForEmail(email),
      status: record?.status === "denied" ? "denied" : "approved",
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SHARE_COOKIE)?.value;
  if (token) {
    const payload = verifyToken<{ l: string; exp: number }>(token);
    if (payload) {
      const link = await getValidShareLink(payload.l);
      if (link) {
        return {
          kind: "guest",
          linkId: link.id,
          label: link.label,
          sections: link.sections,
        };
      }
    }
  }

  return null;
}

/** Hrefs this viewer may open (single source of truth: navigation config). */
export function allowedHrefs(viewer: Viewer): string[] {
  const all = navigation.flatMap((s) => s.items);
  if (viewer.kind === "guest") {
    return all.map((i) => i.href).filter((h) => viewer.sections.includes(h));
  }
  if (viewer.status !== "approved") return [];
  return all.filter((i) => hasRole(viewer.role, i.minRole)).map((i) => i.href);
}

/**
 * Server-side gate used by every page. Redirects to sign-in, the
 * pending screen, or the viewer's first allowed section as appropriate.
 */
export async function requireAccess(href: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.kind === "member" && viewer.status === "denied") {
    redirect("/pending");
  }
  if (viewer.kind === "member" && viewer.status === "pending") {
    redirect("/pending");
  }

  const allowed = allowedHrefs(viewer);
  if (!allowed.includes(href)) {
    if (viewer.kind === "member") redirect("/?denied=1");
    redirect(allowed[0] ?? "/sign-in");
  }
  return viewer;
}
