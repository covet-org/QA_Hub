"use client";

export interface FilterOption {
  value: string;
  label: string;
  /** Shown after the label, e.g. how many rows the option covers. */
  count?: number;
}

/**
 * A labelled group of toggle chips. Multi-select by design: every option
 * is independent, and "All" / "None" are shortcuts rather than modes.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  onAll,
  onClear,
}: {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  if (options.length === 0) return null;
  const allSelected = options.every((o) => selected.has(o.value));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="mr-0.5 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
        {label}
      </span>
      {options.map((option) => {
        const on = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              on
                ? "bg-brand-800 text-white shadow-card"
                : "bg-surface-card text-slate-500 ring-1 ring-hairline hover:bg-surface-sunken"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={`nums text-[10px] ${on ? "text-brand-100" : "text-slate-400"}`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={allSelected ? onClear : onAll}
        className="ml-0.5 text-[11px] font-medium text-brand-700 hover:underline"
      >
        {allSelected ? "Clear" : "Select all"}
      </button>
    </div>
  );
}

/** Wrapper that keeps several filter groups on one tidy panel. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface-card px-4 py-3 shadow-card ring-1 ring-hairline">
      {children}
    </div>
  );
}
