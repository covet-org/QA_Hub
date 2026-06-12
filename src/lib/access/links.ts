import "server-only";

import { randomBytes } from "node:crypto";
import { navigation } from "@/config/navigation";
import { kvDelete, kvGet, kvList, kvSet } from "@/lib/store";

/**
 * Shareable access links.
 *
 * An admin creates a link choosing exactly which sections it unlocks.
 * Anyone opening /share/<id> gets a signed cookie and browses those
 * sections as a guest — no Google account needed. Links can expire
 * and can be revoked at any time (revocation cuts off existing
 * cookie holders too, since every request re-validates the link).
 */

export interface ShareLink {
  id: string;
  label: string;
  /** Page hrefs this link unlocks, e.g. ["/roadmap", "/releases"]. */
  sections: string[];
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

const key = (id: string) => `share:${id}`;

/** Sections an admin may put on a link (admin pages are never shareable). */
export function shareableSections(): { href: string; label: string }[] {
  return navigation
    .flatMap((s) => s.items)
    .filter((i) => i.minRole !== "admin")
    .map((i) => ({ href: i.href, label: i.label }));
}

export async function createShareLink(options: {
  label: string;
  sections: string[];
  expiresDays: number | null;
  createdBy: string;
}): Promise<ShareLink> {
  const allowed = new Set(shareableSections().map((s) => s.href));
  const sections = options.sections.filter((s) => allowed.has(s));
  if (sections.length === 0) {
    throw new Error("A share link needs at least one section");
  }

  const link: ShareLink = {
    id: randomBytes(9).toString("base64url"),
    label: options.label.trim() || "Untitled link",
    sections,
    createdBy: options.createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: options.expiresDays
      ? new Date(Date.now() + options.expiresDays * 86_400_000).toISOString()
      : null,
    revoked: false,
  };
  await kvSet(key(link.id), link);
  return link;
}

export async function getValidShareLink(id: string): Promise<ShareLink | null> {
  const link = await kvGet<ShareLink>(key(id));
  if (!link || link.revoked) return null;
  if (link.expiresAt && Date.parse(link.expiresAt) < Date.now()) return null;
  return link;
}

export type ShareLinkWithState = ShareLink & { expired: boolean };

export async function listShareLinks(): Promise<ShareLinkWithState[]> {
  const links = await kvList<ShareLink>("share:");
  const now = Date.now();
  return links
    .map((link) => ({
      ...link,
      expired: Boolean(link.expiresAt && Date.parse(link.expiresAt) < now),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeShareLink(id: string): Promise<void> {
  const link = await kvGet<ShareLink>(key(id));
  if (link) {
    link.revoked = true;
    await kvSet(key(id), link);
  }
}

export async function deleteShareLink(id: string): Promise<void> {
  await kvDelete(key(id));
}
