import type { NextAuthConfig } from "next-auth";
import type { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail, roleForEmail, type Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      role: Role;
    } & DefaultSession["user"];
  }
}

/**
 * Edge-safe Auth.js configuration shared by the proxy and the full
 * node instance in src/auth.ts. Nothing here may touch fs or the KV
 * store — approval-flow side effects live in src/auth.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      authorization: {
        params: {
          // Hint Google to only offer accounts on the workspace domain.
          // This is UX only — the real enforcement is in signIn.
          hd: process.env.ALLOWED_EMAIL_DOMAIN ?? "co.vet",
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    // Hard gate: reject any account outside the allowed domain.
    signIn({ profile }) {
      return isAllowedEmail(profile?.email) && profile?.email_verified === true;
    },
    // Base role from env config; approval status is layered on top by
    // getViewer() (src/lib/viewer.ts) on every request.
    session({ session }) {
      session.user.role = roleForEmail(session.user.email);
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};
