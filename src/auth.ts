import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { ensureAccessRequest } from "@/lib/access/requests";
import { isAllowedEmail } from "@/lib/roles";

/**
 * Full Auth.js instance (node runtime). Extends the edge-safe base
 * config with the approval flow: every sign-in attempt registers an
 * access request and notifies the QA lead until approved; denied
 * accounts are blocked outright. Pending users get a session but are
 * routed to /pending by requireAccess().
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      if (
        !isAllowedEmail(profile?.email) ||
        profile?.email_verified !== true ||
        !profile?.email
      ) {
        return false;
      }
      const record = await ensureAccessRequest(
        profile.email,
        typeof profile.name === "string" ? profile.name : "",
      );
      return record.status !== "denied";
    },
  },
});
