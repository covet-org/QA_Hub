interface TagProps {
  children: React.ReactNode;
  className?: string;
}

/** Small status/category pill, e.g. "In Progress", "PMS". */
export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        className ?? "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {children}
    </span>
  );
}
