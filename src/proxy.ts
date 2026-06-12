import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/sign-in", "/api/access/decision"];

/**
 * First gate (edge runtime): let through members with a session,
 * guests holding a share cookie, and the public endpoints. Deep
 * validation — approval status, share-link revocation, per-section
 * permissions — happens server-side in requireAccess() on every page.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (req.auth) return;
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/share/")) return;
  if (req.cookies.get("qa_share")) return;

  const signInUrl = new URL("/sign-in", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
  return Response.redirect(signInUrl);
});

export const config = {
  // Everything except auth endpoints, Next internals and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
