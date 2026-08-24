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
}

/** A single headline figure. The accent rule carries the tone at a glance. */
export function StatCard({ label, value, hint, tone = "brand" }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-card px-4 py-3.5 shadow-card ring-1 ring-hairline">
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${accentBar[tone]}`}
      />
      <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p
          className={`font-display nums text-[28px] leading-none font-semibold ${valueColor[tone]}`}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
