import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/sign-in", "/no-access"];

/**
 * First gate (edge runtime): let through anyone with a session plus the
 * public pages. Role and block checks happen server-side in
 * requireAccess() on every page.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (req.auth) return;
  if (PUBLIC_PATHS.includes(pathname)) return;

  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
  return Response.redirect(signInUrl);
});

export const config = {
  // Everything except auth endpoints, Next internals and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
