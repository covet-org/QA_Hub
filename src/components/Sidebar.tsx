"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/config/navigation";
import { signOutAction } from "@/lib/actions";
import { hasRole, type Role } from "@/lib/roles";

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

interface SidebarProps {
  sections: NavSection[];
  role: Role;
  userName: string;
  userEmail: string;
}

export function Sidebar({ sections, role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-brand-900 text-brand-100 max-lg:hidden">
      <div className="px-6 pt-6 pb-4">
        <Link href="/" className="block">
          <span className="font-display text-xl font-semibold text-white">
            co<span className="text-accent-400">·</span>vet
          </span>
          <span className="mt-0.5 block text-[11px] tracking-wide text-brand-100/70">
            QA Brain
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => {
          // Hide a whole section when the user can't open any of its items.
          const anyVisible = section.items.some((i) => hasRole(role, i.minRole));
          return (
            <div key={section.title} className="mt-5">
              <p className="px-3 text-[10px] font-semibold tracking-[0.18em] text-brand-100/50 uppercase">
                {section.title}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {section.items.map((item) => {
                  const unlocked = hasRole(role, item.minRole);
                  const active = pathname === item.href;
                  if (!anyVisible) return null;
                  return (
                    <li key={item.href}>
                      {unlocked ? (
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
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium text-white">{userName}</p>
        <p className="truncate text-xs text-brand-100/60">{userEmail}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-300 uppercase">
            {role}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs text-brand-100/60 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
