import Link from "next/link";

export type StatTone = "brand" | "success" | "danger" | "warn" | "neutral";

const accentBar: Record<StatTone, string> = {
  brand: "bg-brand-600",
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  warn: "bg-amber-400",
  neutral: "bg-slate-300",
};

const valueColor: Record<StatTone, string> = {
  brand: "text-brand-800",
  success: "text-emerald-700",
  danger: "text-rose-700",
  warn: "text-amber-700",
  neutral: "text-slate-700",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  /** Colours the accent rule and the figure — use it to flag problems. */
  tone?: StatTone;
  /**
   * Where the figure came from. A headline number invites the question
   * "which ones?", and the answer is always a board in this app, so the
   * whole tile becomes the link rather than some word inside it.
   */
  href?: string;
  /**
   * Rendered under the figure — a progress bar, a sparkline. Keeps a tile
   * that needs one shape-identical to the tiles beside it, which is the
   * whole point of them being tiles.
   */
  footer?: React.ReactNode;
}

/** A single headline figure. The accent rule carries the tone at a glance. */
export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
  href,
  footer,
}: StatCardProps) {
  const body = (
    <>
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${accentBar[tone]}`}
      />
      <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p
          className={`font-display nums text-2xl leading-none font-semibold ${valueColor[tone]}`}
        >
          {value}
        </p>
        {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      </div>
      {footer && <div className="mt-2.5">{footer}</div>}
    </>
  );

  const shell =
    "relative flex h-full flex-col justify-center overflow-hidden rounded-xl bg-surface-card px-4 py-3.5 shadow-card ring-1 ring-hairline";

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${shell} group transition-shadow hover:shadow-card-hover hover:ring-brand-200`}
    >
      {body}
      <span
        aria-hidden
        className="absolute top-3 right-3 text-[11px] text-slate-300 transition-colors group-hover:text-brand-600"
      >
        →
      </span>
    </Link>
  );
}
