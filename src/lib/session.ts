import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRole, type Role } from "@/lib/roles";

/** Get the current session or redirect to sign-in. For server components. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return session;
}

/**
 * Get the current session and enforce a minimum role.
 * Users below the required role land on the home page with a notice.
 */
export async function requireRole(role: Role) {
  const session = await requireSession();
  if (!hasRole(session.user.role, role)) {
    redirect("/?denied=1");
  }
  return session;
}
