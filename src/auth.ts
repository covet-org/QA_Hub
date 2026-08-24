import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { ensureAccessRequest } from "@/lib/access/requests";
import { isAllowedEmail } from "@/lib/roles";

/**
 * Full Auth.js instance (node runtime). Extends the edge-safe base
 * config: a verified account on the allowed domain is admitted, its
 * record is created as approved, and the QA lead is emailed on the first
 * arrival. Only an explicit `denied` record blocks a domain member.
 *
 * A store failure must not lock people out — the record write is
 * best-effort, and access is decided from the email domain.
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
      try {
        const record = await ensureAccessRequest(
          profile.email,
          typeof profile.name === "string" ? profile.name : "",
        );
        return record.status !== "denied";
      } catch (error) {
        // Store unreachable: admit the domain member anyway. Being
        // unable to write a record is not a reason to reject a
        // colleague, and this used to send everyone to /pending.
        console.error(
          `Access record unavailable for ${profile.email}: ${error instanceof Error ? error.message : error}`,
        );
        return true;
      }
    },
  },
});
