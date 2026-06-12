import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getValidShareLink } from "@/lib/access/links";
import { signToken } from "@/lib/access/token";
import { SHARE_COOKIE } from "@/lib/viewer";

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Entry point for shared links: /share/<id> validates the link, sets
 * the signed guest cookie and drops the visitor on the first section
 * the link unlocks. Every subsequent request re-validates the link,
 * so revoking it locks existing visitors out immediately.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getValidShareLink(id);
  if (!link) {
    redirect("/sign-in?error=ShareLinkInvalid");
  }

  const ttlSeconds = link.expiresAt
    ? Math.max(60, Math.floor((Date.parse(link.expiresAt) - Date.now()) / 1000))
    : DEFAULT_TTL_SECONDS;

  const cookieStore = await cookies();
  cookieStore.set(SHARE_COOKIE, signToken({ l: link.id }, ttlSeconds), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });

  redirect(link.sections[0] ?? "/sign-in");
}
