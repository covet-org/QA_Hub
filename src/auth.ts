import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail, roleForEmail, type Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      role: Role;
    } & DefaultSession["user"];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          // Hint Google to only offer accounts on the workspace domain.
          // This is UX only — the real enforcement is in signIn below.
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
    // Role is resolved from env config on every request, so changing
    // QA_ADMIN_EMAILS / QA_TEAM_EMAILS takes effect without re-login.
    session({ session }) {
      session.user.role = roleForEmail(session.user.email);
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
