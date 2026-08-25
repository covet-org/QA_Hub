"use client";

/**
 * The filter control. One component, one look, one keyboard behaviour —
 * every filter in the app is this with different variables.
 *
 * Before this there were four: a multi-select on the roadmap board, a
 * single-select pill row on the bug board, a priority row with colour
 * dots, and the initiative status pills. They disagreed on radius,
 * height, type size and what "all" meant.
 *
 * Selection is always an array, whatever the mode:
 *   mode="multi"  → every selected value
 *   mode="single" → zero or one value
 *
 * `emptyMeans` decides what an empty array communicates, because the two
 * conventions in the app are genuinely different and both are correct:
 *   "all"  → nothing selected = no filter applied (bug priorities)
 *   "none" → nothing selected = show nothing (release pickers)
 */
export type FilterMode = "single" | "multi";

export interface FilterOption {
  value: string;
  label: string;
  /** Shown after the label, e.g. how many rows the option covers. */
  count?: number;
  /** Tailwind background class for a leading dot, e.g. priority colour. */
  dotClass?: string;
}

interface FilterGroupProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  mode?: FilterMode;
  emptyMeans?: "all" | "none";
  /** Adds a leading chip that clears the selection. */
  allLabel?: string;
  /** Adds a trailing "Select all / Clear" shortcut (multi only). */
  bulk?: boolean;
}

export function FilterGroup({
  label,
  options,
  selected,
  onChange,
  mode = "multi",
  emptyMeans = "none",
  allLabel,
  bulk = false,
}: FilterGroupProps) {
  if (options.length === 0) return null;

  const chosen = new Set(selected);
  const allSelected = options.every((o) => chosen.has(o.value));
  // With emptyMeans="all", an empty selection IS the "All" state.
  const allActive = emptyMeans === "all" ? chosen.size === 0 : allSelected;

  function toggle(value: string) {
    if (mode === "single") {
      onChange(chosen.has(value) ? [] : [value]);
      return;
    }
    const next = new Set(chosen);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="mr-0.5 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
        {label}
      </span>

      {allLabel && (
        <Chip active={allActive} onClick={() => onChange([])}>
          {allLabel}
        </Chip>
      )}

      {options.map((option) => (
        <Chip
          key={option.value}
          active={chosen.has(option.value)}
          dotClass={option.dotClass}
          count={option.count}
          onClick={() => toggle(option.value)}
        >
          {option.label}
        </Chip>
      ))}

      {bulk && mode === "multi" && (
        <button
          type="button"
          onClick={() =>
            allSelected ? onChange([]) : onChange(options.map((o) => o.value))
          }
          className="ml-0.5 text-[11px] font-medium text-brand-700 hover:underline"
        >
          {allSelected ? "Clear" : "Select all"}
        </button>
      )}
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
  count,
  dotClass,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  count?: number;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-brand-800 text-white shadow-card"
          : "bg-surface-card text-slate-500 ring-1 ring-hairline ring-inset hover:bg-surface-sunken"
      }`}
    >
      {dotClass && (
        <span aria-hidden className={`size-1.5 rounded-full ${dotClass}`} />
      )}
      {children}
      {count !== undefined && (
        <span
          className={`nums text-[10px] ${active ? "text-brand-100" : "text-slate-400"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Panel that keeps several filter groups on one tidy surface. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface-card px-4 py-3 shadow-card ring-1 ring-hairline">
      {children}
    </div>
  );
}
