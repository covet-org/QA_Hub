import type { ReleaseProgression as Progression } from "@/lib/release-progression";
import type { RunSummary } from "@/lib/testiny/types";
import {
  EmptyState,
  RunProgressBar,
  RunProgressLegend,
  runProgress,
  Tag,
} from "@/components/ui";

/**
 * How far the release in flight has got, both phases side by side.
 *
 * A release is tested in two runs sharing one number — dev/sandbox then
 * regression — and neither alone answers "are we ready to ship". Showing
 * them together is the point of the card: regression at 0% while dev sits
 * at 100% is a different situation from both at 50%.
 *
 * A server component: it renders the same bar RunCard uses, without that
 * card's on-demand release content and descope machinery.
 */
function Phase({
  label,
  run,
  missingNote,
}: {
  label: string;
  run: RunSummary | null;
  missingNote: string;
}) {
  if (!run) {
    return (
      <div className="rounded-lg bg-surface-sunken px-3 py-2.5">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          {label}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">{missingNote}</p>
      </div>
    );
  }

  const { executed, percent } = runProgress(run);

  return (
    <div className="rounded-lg bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-display nums text-base leading-none font-semibold text-brand-800">
            {percent}%
          </span>
          <span className="nums text-[11px] text-slate-500">
            {executed} of {run.total} executed
          </span>
        </div>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-500" title={run.title}>
        {run.title}
      </p>
      <RunProgressBar run={run} className="mt-2" />
      <RunProgressLegend run={run} className="mt-2" />
    </div>
  );
}

export function ReleaseProgressionPanel({
  progression,
}: {
  progression: Progression | null;
}) {
  if (!progression) {
    return (
      <EmptyState>
        No Testiny run carries a release number yet, so there is no
        progression to show.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <h3 className="font-display text-sm font-semibold text-slate-800">
          {progression.release}
        </h3>
        <Tag tone={progression.isActive ? "success" : "neutral"}>
          {progression.isActive ? "In testing" : "Shipped"}
        </Tag>
        {!progression.isActive && (
          <span className="text-[11px] text-slate-400">
            nothing in testing right now — showing the last release
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Phase
          label="Dev / Sandbox"
          run={progression.dev}
          missingNote="No dev run for this release in Testiny."
        />
        <Phase
          label="Regression"
          run={progression.regression}
          missingNote="No regression run yet — it opens once dev testing clears."
        />
      </div>
    </div>
  );
}
