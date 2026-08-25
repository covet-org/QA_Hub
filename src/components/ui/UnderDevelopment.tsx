/**
 * A page that is still being built, shown rather than hidden.
 *
 * The content underneath stays readable — whatever already works is
 * still worth something to QA — but greyed and captioned, so nobody
 * reports a half-finished page as broken or quotes a number from it in a
 * standup. The wash is deliberately light: this is "do not trust yet",
 * not "unavailable".
 *
 * The scrim takes no pointer events, so the page beneath remains usable
 * for anyone who knows what they are looking at.
 */
export function UnderDevelopment({
  children,
  note = "This page is still being developed. What you see below is work in progress — don't rely on these numbers yet.",
  compact = false,
}: {
  children: React.ReactNode;
  note?: string;
  /**
   * For one card inside an otherwise trustworthy page, rather than a whole
   * page. The notice sits inline instead of floating: a sticky banner
   * belongs to a page, and inside a card it would follow the reader
   * around a screen full of numbers that are fine.
   */
  compact?: boolean;
}) {
  return (
    <div className="relative">
      {/* Notice first in the DOM: a screen reader should hear it before
          the content it qualifies, and it must not be buried mid-page. */}
      <div
        role="status"
        className={
          compact
            ? "mb-3 flex"
            : "sticky top-3 z-20 mb-4 flex justify-center"
        }
      >
        <p
          className={
            compact
              ? "flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-900 ring-1 ring-amber-200"
              : "mx-4 flex items-start gap-2 rounded-xl bg-amber-50/95 px-4 py-2.5 text-[12px] leading-relaxed text-amber-900 shadow-card ring-1 ring-amber-200 backdrop-blur"
          }
        >
          <span aria-hidden className="mt-px text-[13px] leading-none">
            🚧
          </span>
          <span>
            <span className="font-semibold">Being reworked.</span> {note}
          </span>
        </p>
      </div>

      <div className="relative">
        <div className="opacity-55 saturate-50">{children}</div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl bg-slate-500/10"
        />
      </div>
    </div>
  );
}
