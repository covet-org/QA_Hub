interface HeroProps {
  kicker: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  footnote?: string;
}

/** Teal banner header used at the top of every page, Product Brain style. */
export function Hero({ kicker, title, description, children, footnote }: HeroProps) {
  return (
    <header className="bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 px-8 py-10 text-white sm:px-12">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent-300 uppercase">
        {kicker}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold">
        {title}
        <span className="text-accent-400">.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-100/90">
        {description}
      </p>
      {children && <div className="mt-6">{children}</div>}
      {footnote && (
        <p className="mt-5 text-[11px] font-medium tracking-wider text-brand-100/60 uppercase">
          {footnote}
        </p>
      )}
    </header>
  );
}
