import type { Role } from "@/lib/roles";

export interface NavItem {
  label: string;
  href: string;
  /** Minimum role required; items above the user's role render locked. */
  minRole: Role;
  /**
   * Sub-pages rendered as an expandable group in the sidebar.
   * Access is governed by the parent href (also for share links).
   */
  children?: { label: string; href: string }[];
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
      {
        label: "Releases",
        href: "/releases",
        minRole: "viewer",
        children: [
          { label: "Active", href: "/releases/active" },
          { label: "Closed", href: "/releases/closed" },
        ],
      },
      {
        label: "Bugs",
        href: "/bugs",
        minRole: "viewer",
        children: [
          { label: "Bugs", href: "/bugs/product" },
          { label: "CS Bugs", href: "/bugs/cs" },
        ],
      },
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
