interface HeroProps {
  kicker: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  footnote?: string;
}

/**
 * Page header band. Deliberately compact — it carries the brand and the
 * page's one-line purpose, then gets out of the way so data is above the
 * fold. Extra bottom padding lets the page shell pull its first row up
 * over the band edge (see `page-shell` usage in the pages).
 */
export function Hero({
  kicker,
  title,
  description,
  children,
  footnote,
}: HeroProps) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white">
      {/* Soft highlight so the flat teal reads as a lit surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent-400/15 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-[1440px] px-6 pt-7 pb-16 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-accent-300 uppercase">
              {kicker}
            </p>
            <h1 className="font-display mt-1.5 text-2xl font-semibold tracking-tight">
              {title}
              <span className="text-accent-400">.</span>
            </h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-brand-100/85">
              {description}
            </p>
          </div>
          {footnote && (
            <p className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-brand-100/80 uppercase ring-1 ring-inset ring-white/10">
              {footnote}
            </p>
          )}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </header>
  );
}
