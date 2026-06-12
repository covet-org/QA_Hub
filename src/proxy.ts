import { auth } from "@/auth";

/**
 * Require a session for every page. Unauthenticated users are redirected
 * to /sign-in (configured in src/auth.ts → pages.signIn).
 * Per-section role checks happen server-side in each page via requireRole().
 */
export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/sign-in") {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  // Everything except auth endpoints, Next internals and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
