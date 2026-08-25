import type { ReleaseProgression as Progression } from "@/lib/release-progression";
import type { RunSummary } from "@/lib/testiny/types";
import {
  EmptyState,
  RunProgressBar,
  runProgress,
  Tag,
} from "@/components/ui";

/**
 * How far the release in flight has got.
 *
 * Dev and regression never run at the same time — regression opens once
 * dev testing clears — so this reads as a sequence rather than a
 * comparison: two thin rows, the one with work on it carrying the
 * numbers. That is what lets the card sit in the top row beside the bug
 * count instead of taking a full-width band to say one number.
 *
 * The per-state legend lives on the Releases board, one click away
 * through the card title. A landing page owes the reader "how far", not
 * every count.
 *
 * A server component: it renders the same bar RunCard uses, without that
 * card's on-demand release content and descope machinery.
 */
function PhaseRow({
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
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
          {label}
        </p>
        <p className="text-[11px] text-slate-400">{missingNote}</p>
      </div>
    );
  }

  const { executed, percent } = runProgress(run);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-display nums text-sm leading-none font-semibold text-brand-800">
            {percent}%
          </span>
          <span className="nums text-[11px] text-slate-500">
            {executed} of {run.total}
          </span>
        </div>
      </div>
      <RunProgressBar run={run} className="mt-1.5" />
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
        <span className="font-display text-lg leading-none font-semibold text-slate-800">
          {progression.release}
        </span>
        <Tag tone={progression.isActive ? "success" : "neutral"}>
          {progression.isActive ? "In testing" : "Shipped"}
        </Tag>
        {!progression.isActive && (
          <span className="text-[11px] text-slate-400">last to ship</span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <PhaseRow
          label="Dev / Sandbox"
          run={progression.dev}
          missingNote="no dev run"
        />
        <PhaseRow
          label="Regression"
          run={progression.regression}
          missingNote="opens once dev clears"
        />
      </div>
    </div>
  );
}
