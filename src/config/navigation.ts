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
  /**
   * Short status shown beside the label, e.g. "being reworked". Lives
   * here so the sidebar badge and the page's own notice cannot disagree
   * about which pages are unfinished.
   */
  note?: string;
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
      {
        label: "Roadmap",
        href: "/roadmap",
        minRole: "viewer",
        children: [
          { label: "Board", href: "/roadmap" },
          { label: "Design Sign-off", href: "/roadmap/sign-off" },
        ],
      },
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
          { label: "QA Bugs", href: "/bugs/product" },
          { label: "Regression Bugs", href: "/bugs/regression" },
          { label: "CS Bugs", href: "/bugs/cs" },
        ],
      },
    ],
  },
  {
    title: "Testing",
    items: [
      {
        label: "Manual Testing",
        href: "/manual",
        minRole: "qa",
        note: "being reworked",
      },
      {
        label: "Automation",
        href: "/automation",
        minRole: "qa",
        note: "being reworked",
      },
    ],
  },
  {
    title: "Admin",
    items: [{ label: "Access", href: "/access", minRole: "admin" }],
  },
];
