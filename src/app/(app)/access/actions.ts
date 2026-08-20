"use server";

import { revalidatePath } from "next/cache";
import { createShareLink, revokeShareLink } from "@/lib/access/links";
import {
  decideAccess,
  inviteUser,
  isAdminEmail,
  removeAccess,
  setUserRole,
} from "@/lib/access/requests";
import { isAllowedEmail, type Role } from "@/lib/roles";
import { getViewer } from "@/lib/viewer";

const ROLES: Role[] = ["viewer", "qa", "admin"];
const asRole = (v: unknown): Role =>
  ROLES.includes(v as Role) ? (v as Role) : "viewer";

/** All admin actions re-verify the caller server-side. */
async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer?.kind !== "member" || viewer.role !== "admin") {
    throw new Error("Not authorized");
  }
  return viewer;
}

export async function decideAccessAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "");
  const action = String(formData.get("action") ?? "");
  const role = asRole(formData.get("role"));

  if (!email || (action !== "approve" && action !== "deny")) return;
  await decideAccess({ email, action, role, decidedBy: admin.email });
  revalidatePath("/access");
}

/** Change an approved user's role. */
export async function setRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "");
  const role = asRole(formData.get("role"));
  if (email) await setUserRole(email, role, admin.email);
  revalidatePath("/access");
}

/** Remove a user from the allowlist. Bootstrap (env) admins can't be removed. */
export async function removeUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  if (email && !isAdminEmail(email)) await removeAccess(email);
  revalidatePath("/access");
}

/** Invite (pre-authorize + email) a new user. */
export async function inviteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = asRole(formData.get("role"));
  if (email && isAllowedEmail(email)) {
    await inviteUser({ email, role, invitedBy: admin.email });
  }
  revalidatePath("/access");
}

export async function createShareLinkAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const label = String(formData.get("label") ?? "");
  const sections = formData.getAll("sections").map(String);
  const expiresRaw = String(formData.get("expiresDays") ?? "");
  const expiresDays = expiresRaw ? Number(expiresRaw) : null;

  await createShareLink({
    label,
    sections,
    expiresDays: expiresDays && expiresDays > 0 ? expiresDays : null,
    createdBy: admin.email,
  });
  revalidatePath("/access");
}

export async function revokeShareLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await revokeShareLink(id);
  revalidatePath("/access");
}
