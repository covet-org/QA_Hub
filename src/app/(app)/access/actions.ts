"use server";

import { revalidatePath } from "next/cache";
import { createShareLink, revokeShareLink } from "@/lib/access/links";
import { decideAccess } from "@/lib/access/requests";
import type { Role } from "@/lib/roles";
import { getViewer } from "@/lib/viewer";

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
  const role = String(formData.get("role") ?? "viewer") as Role;

  if (!email || (action !== "approve" && action !== "deny")) return;
  await decideAccess({ email, action, role, decidedBy: admin.email });
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
