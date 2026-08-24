import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { isBlockedEmail, notifySignIn } from "@/lib/access/members";
import { isAllowedEmail } from "@/lib/roles";

/**
 * Full Auth.js instance (node runtime). Extends the edge-safe base
 * config with the sign-in notification.
 *
 * Access is pure configuration — domain + env lists, no database — so
 * nothing here can fail because a store is unreachable. That was the
 * cause of the "Access Denied" screen: the old callback awaited a KV
 * read that threw while Upstash was down.
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
      if (isBlockedEmail(profile.email)) {
        console.warn(`Blocked sign-in attempt: ${profile.email}`);
        return false;
      }
      // Fire and forget: the notification must never delay or block a
      // sign-in, and notifySignIn swallows its own failures.
      void notifySignIn(
        profile.email,
        typeof profile.name === "string" ? profile.name : "",
      );
      return true;
    },
  },
});
