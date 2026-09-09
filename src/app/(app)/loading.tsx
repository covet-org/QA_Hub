/**
 * What a page shows while its data is being read.
 *
 * This file is why navigation feels instant. Without a loading boundary,
 * the App Router blocks a soft navigation on the whole server render: the
 * browser stays on the previous page, showing nothing, until every Linear
 * and Testiny read has finished. Clicking "Closed" and watching nothing
 * happen for several seconds was that, not a slow browser.
 *
 * It also changes what a prefetch costs. With a boundary here, Next
 * prefetches only up to it — the shell, which is static — so the sidebar
 * can hint at a route without firing that page's queries for someone who
 * never opens it. That was the reason prefetching was turned off, and it
 * no longer applies.
 *
 * Shaped like the real page (header band, then cards) so the swap is a
 * fill-in rather than a jump.
 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/20 ${className}`} />;
}

function Card() {
  return (
    <div className="rounded-xl bg-surface-card p-4 shadow-card ring-1 ring-hairline">
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-1/4 rounded bg-slate-200" />
        <div className="h-2 w-2/3 rounded bg-slate-100" />
        <div className="h-2 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div>
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 pb-16 text-white">
        <div className="relative mx-auto w-full max-w-[1440px] px-6 pt-8 sm:px-8">
          <Bar className="h-2.5 w-32" />
          <div className="mt-3">
            <Bar className="h-6 w-64" />
          </div>
          <div className="mt-3">
            <Bar className="h-2.5 w-96 max-w-full" />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
        <Card />
        <Card />
        <Card />
      </div>

      <span className="sr-only" role="status">
        Loading
      </span>
    </div>
  );
}
