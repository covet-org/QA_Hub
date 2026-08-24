interface AllocationBarProps {
  manual: number;
  automation: number;
  showLabels?: boolean;
}

/** Horizontal split bar visualizing manual vs automation effort. */
export function AllocationBar({ manual, automation, showLabels = true }: AllocationBarProps) {
  return (
    <div>
      {showLabels && (
        <div className="mb-1 flex justify-between text-[10px] font-medium text-slate-500">
          <span>
            Manual <span className="text-slate-700">{manual}%</span>
          </span>
          <span>
            Automation <span className="text-slate-700">{automation}%</span>
          </span>
        </div>
      )}
      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Effort split: ${manual}% manual, ${automation}% automation`}
      >
        <div className="bg-brand-600" style={{ width: `${manual}%` }} />
        <div className="bg-accent-400" style={{ width: `${automation}%` }} />
      </div>
    </div>
  );
}
