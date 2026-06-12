import type { Role } from "@/lib/roles";

export interface NavItem {
  label: string;
  href: string;
  /** Minimum role required; items above the user's role render locked. */
  minRole: Role;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Sidebar structure. Adding a page = add the route + one entry here;
 * lock icons and access enforcement follow from minRole automatically
 * (enforced server-side via requireRole in each page).
 */
export const navigation: NavSection[] = [
  {
    title: "QA",
    items: [
      { label: "Home", href: "/", minRole: "viewer" },
      { label: "Roadmap", href: "/roadmap", minRole: "viewer" },
      { label: "Releases", href: "/releases", minRole: "viewer" },
    ],
  },
  {
    title: "Testing",
    items: [
      { label: "Manual Testing", href: "/manual", minRole: "qa" },
      { label: "Automation", href: "/automation", minRole: "qa" },
    ],
  },
  {
    title: "Admin",
    items: [{ label: "Access", href: "/access", minRole: "admin" }],
  },
];
