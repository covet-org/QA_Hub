/**
 * Page content container.
 *
 * The same class string was pasted into all seven pages, so any change to
 * page width or the pull-up over the header band meant seven edits and a
 * chance for one to drift. It lives here now.
 *
 * The negative top margin lifts the first row over the header band's
 * bottom padding — see PageHeader, which reserves that space.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
      {children}
    </div>
  );
}

/** What a board shows when a filter matches nothing. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-surface-card px-5 py-10 text-center text-xs text-slate-500 shadow-card ring-1 ring-hairline">
      {children}
    </p>
  );
}

/** Small uppercase label for grouping content inside a page. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
      {children}
    </p>
  );
}
