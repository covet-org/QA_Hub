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
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-4 pt-3.5 pb-3">
      <div className="min-w-0">
        <h2 className="font-display text-sm leading-tight font-semibold text-slate-800">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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
