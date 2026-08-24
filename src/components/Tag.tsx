export type TagTone =
  | "neutral"
  | "muted"
  | "brand"
  | "success"
  | "danger"
  | "warn"
  | "info"
  | "violet";

const toneClass: Record<TagTone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  muted: "bg-slate-50 text-slate-400 ring-slate-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

interface TagProps {
  children: React.ReactNode;
  /** Semantic tone; prefer this over passing raw colour classes. */
  tone?: TagTone;
  /** Escape hatch for one-off colours (wins over `tone`). */
  className?: string;
}

/** Small status/category pill, e.g. "In Progress", "Urgent". */
export function Tag({ children, tone = "neutral", className }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${
        className ?? toneClass[tone]
      }`}
    >
      {children}
    </span>
  );
}

/** A tag with a leading dot — for legends where colour carries meaning. */
export function DotTag({
  children,
  dotClass,
  tone = "neutral",
}: {
  children: React.ReactNode;
  dotClass: string;
  tone?: TagTone;
}) {
  return (
    <Tag tone={tone}>
      <span className={`mr-1.5 size-1.5 rounded-full ${dotClass}`} />
      {children}
    </Tag>
  );
}
