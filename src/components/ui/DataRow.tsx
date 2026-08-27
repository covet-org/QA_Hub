/**
 * The row every board is made of: a ticket link, fixed-width slots, a
 * title that takes the remaining width, and trailing meta.
 *
 * Roadmap rows, bug rows, descope rows and test-case rows were four
 * near-identical blocks that had drifted apart on padding, truncation and
 * the width of the id column — which is why ids stopped lining up between
 * boards. One component, one set of metrics.
 */
export function DataRow({
  leading,
  slots,
  title,
  titleAttr,
  trailing,
  below,
  nested = false,
}: {
  /** Usually the ticket link. Fixed width so titles align down the page. */
  leading?: React.ReactNode;
  /** Fixed-width cells between the id and the title (priority, state). */
  slots?: React.ReactNode;
  title: React.ReactNode;
  /** Tooltip for a truncated title. */
  titleAttr?: string;
  /** Tags, counts, dates — pushed to the right. */
  trailing?: React.ReactNode;
  /**
   * Full-width block under the row, inside the same list item: for detail
   * that belongs to this row but cannot fit on its line.
   */
  below?: React.ReactNode;
  /** Indents the row and marks it as a child of the row above. */
  nested?: boolean;
}) {
  return (
    <li
      className={
        nested
          ? "border-l-2 border-brand-100 py-2 pr-4 pl-3 transition-colors hover:bg-white"
          : "px-4 py-2.5 transition-colors hover:bg-surface-sunken"
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {leading}
        {slots}
        <span
          className="min-w-[12rem] flex-1 truncate text-xs text-slate-800"
          title={titleAttr}
        >
          {title}
        </span>
        {trailing}
      </div>
      {below}
    </li>
  );
}

/** Monospace ticket link in the fixed leading slot. */
export function TicketLink({ id, url }: { id: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="w-[68px] shrink-0 font-mono text-[11px] font-semibold text-brand-700 hover:underline"
    >
      {id}
    </a>
  );
}

/**
 * Fixed-width cell. Keeps columns aligned when a value is missing —
 * an untriaged ticket still occupies its priority slot, so the titles
 * beside it do not shift.
 */
export function Slot({
  children,
  width = 70,
  placeholder = "—",
}: {
  children?: React.ReactNode;
  width?: number;
  placeholder?: string;
}) {
  return (
    <span className="shrink-0" style={{ width }}>
      {children ?? (
        <span className="block text-center text-[11px] text-slate-300">
          {placeholder}
        </span>
      )}
    </span>
  );
}

/** Right-aligned secondary text: dates, counts, assignees. */
export function Meta({
  children,
  title,
  width,
  muted = false,
}: {
  children: React.ReactNode;
  title?: string;
  width?: number;
  muted?: boolean;
}) {
  return (
    <span
      className={`shrink-0 text-right text-[11px] ${muted ? "text-slate-300" : "text-slate-500"}`}
      style={width ? { width } : undefined}
      title={title}
    >
      {children}
    </span>
  );
}
