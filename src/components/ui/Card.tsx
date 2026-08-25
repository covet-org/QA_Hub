import Link from "next/link";

/** Standard card surface. Every panel in the app should sit on one. */
export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Lifts on hover — only for cards that expand or navigate. */
  interactive?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl bg-surface-card shadow-card ring-1 ring-hairline ${
        interactive ? "transition-shadow hover:shadow-card-hover" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

/** Card title row: label on the left, tags or counts on the right. */
export function CardHeader({
  title,
  titleHref,
  subtitle,
  actions,
  footnote,
  badge,
}: {
  title: React.ReactNode;
  /**
   * The board this card summarises. A chart answers "how many"; the link
   * answers the "which ones" it provokes, without a separate row of
   * "view all" furniture.
   */
  titleHref?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * Where the card's numbers came from. Same vocabulary as PageHeader's
   * footnote: quieter than the subtitle, because it answers "can I trust
   * this" rather than "what am I looking at".
   */
  footnote?: React.ReactNode;
  /**
   * Short status beside the title, e.g. "being reworked" — the same words
   * the sidebar uses for a page, for a card that has the same problem.
   */
  badge?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-4 pt-3.5 pb-3">
      <div className="min-w-0">
        <h2 className="font-display text-sm leading-tight font-semibold text-slate-800">
          {titleHref ? (
            <Link
              href={titleHref}
              className="group inline-flex items-center gap-1 hover:text-brand-700 hover:underline"
            >
              {title}
              <span
                aria-hidden
                className="text-slate-300 transition-colors group-hover:text-brand-600"
              >
                →
              </span>
            </Link>
          ) : (
            title
          )}
          {badge && (
            <span className="ml-2 align-middle rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-amber-800 ring-1 ring-amber-200">
              {badge}
            </span>
          )}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {subtitle}
          </p>
        )}
        {footnote && (
          <p className="mt-1 text-[10px] text-slate-400">{footnote}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-4 pb-4 ${className}`}>{children}</div>;
}

/** Section label for grouping content inside a page. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
      {children}
    </p>
  );
}
