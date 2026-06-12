"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/lib/actions";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="size-3.5 opacity-50"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-label="Restricted"
    >
      <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1.5-2v2h5V5a2.5 2.5 0 0 0-5 0Z" />
    </svg>
  );
}

export interface PreparedNavItem {
  label: string;
  href: string;
  unlocked: boolean;
  children?: { label: string; href: string }[];
}

export interface PreparedNavSection {
  title: string;
  items: PreparedNavItem[];
}

interface SidebarProps {
  /** Sections already filtered/marked for the current viewer. */
  sections: PreparedNavSection[];
  userLabel: string;
  userSub: string;
  badge: string;
  canSignOut: boolean;
}

function NavGroup({
  item,
  pathname,
}: {
  item: PreparedNavItem;
  pathname: string;
}) {
  const inGroup = pathname.startsWith(item.href);
  const [open, setOpen] = useState(inGroup);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
          inGroup
            ? "font-medium text-white"
            : "text-brand-100/85 hover:bg-brand-800 hover:text-white"
        }`}
      >
        {item.label}
        <Chevron open={open} />
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children!.map((child) => {
            const active = pathname === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={`block rounded-lg py-1.5 pr-3 pl-7 text-sm transition-colors ${
                    active
                      ? "bg-brand-700 font-medium text-white"
                      : "text-brand-100/75 hover:bg-brand-800 hover:text-white"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Sidebar({
  sections,
  userLabel,
  userSub,
  badge,
  canSignOut,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-brand-900 text-brand-100 max-lg:hidden">
      <div className="px-6 pt-6 pb-4">
        <span className="font-display text-xl font-semibold text-white">
          co<span className="text-accent-400">·</span>vet
        </span>
        <span className="mt-0.5 block text-[11px] tracking-wide text-brand-100/70">
          QA Brain
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="mt-5">
            <p className="px-3 text-[10px] font-semibold tracking-[0.18em] text-brand-100/50 uppercase">
              {section.title}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    {item.unlocked && item.children?.length ? (
                      <NavGroup item={item} pathname={pathname} />
                    ) : item.unlocked ? (
                      <Link
                        href={item.href}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-brand-700 font-medium text-white"
                            : "text-brand-100/85 hover:bg-brand-800 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-brand-100/40"
                        title="You don't have access to this section"
                      >
                        {item.label}
                        <LockIcon />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium text-white">{userLabel}</p>
        <p className="truncate text-xs text-brand-100/60">{userSub}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-300 uppercase">
            {badge}
          </span>
          {canSignOut && (
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-xs text-brand-100/60 hover:text-white"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );
}
