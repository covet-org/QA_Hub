import { BugBoard } from "@/components/BugBoard";
import {
  bugLabelFor,
  getBugsSnapshot,
  getCsBugBoard,
  type BugKind,
} from "@/lib/bugs";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell } from "@/components/ui";

/**
 * Shared server view for the three Bugs boards: QA, Regression and CS.
 *
 * All three read one snapshot function, so they group by release and order
 * their rows identically — open bugs first, Urgent to Low within those,
 * newest id last. Only the copy and CS's release-window grouping differ.
 */
const COPY: Record<BugKind, { kicker: string; title: string }> = {
  product: { kicker: "Bugs · QA", title: "QA Bugs" },
  regression: { kicker: "Bugs · Regression", title: "Regression Bugs" },
  cs: { kicker: "Bugs · Customer Support", title: "CS Bugs" },
};

function describe(kind: BugKind, label: string): string {
  if (kind === "cs") {
    return `Every Linear ticket labeled "${label}", grouped by the release that was in production when it arrived — a release owns production from its go-live until the next release's. Opens on the last two releases; use + More for older ones.`;
  }
  if (kind === "regression") {
    return `Every Linear ticket labeled "${label}", wherever it sits, grouped by release and ordered exactly as QA Bugs: open bugs first, Urgent to Low within them.`;
  }
  return `Linear tickets labeled "${label}", grouped by release. Lands on the releases still in testing — switch to closed releases for the shipped history.`;
}

export async function BugsView({ kind }: { kind: BugKind }) {
  await requireAccess("/bugs");
  const isCs = kind === "cs";
  const label = bugLabelFor(kind);
  // CS bugs are grouped by which release was in production when they
  // arrived — the same attribution the Home chart draws. Product and
  // regression bugs carry their release on the ticket, so they keep the
  // project-based grouping.
  const csBoard = isCs ? await getCsBugBoard() : null;
  const snapshot = csBoard ?? (await getBugsSnapshot(kind));

  return (
    <div>
      <PageHeader
        kicker={COPY[kind].kicker}
        title={COPY[kind].title}
        description={describe(kind, label)}
        footnote={
          isCs
            ? [
                "Linear · go-live from the production release pipeline",
                csBoard && csBoard.outsideWindows > 0 && csBoard.oldestRelease
                  ? `${csBoard.outsideWindows} older customer bugs predate ${csBoard.oldestRelease} and are not shown`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : kind === "regression"
              ? `Linear · every ticket carrying the "${label}" label, including any parked outside a release project`
              : "Linear · active releases derived from open Testiny runs"
        }
      />
      <PageShell>
        {snapshot.isSample && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <span className="font-semibold">Linear not connected.</span> Set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px]">
              LINEAR_API_KEY
            </code>{" "}
            to list bugs.
          </div>
        )}

        {isCs && csBoard ? (
          <BugBoard groups={snapshot.groups} revealAfter={2} />
        ) : (
          <BugBoard groups={snapshot.groups} />
        )}
      </PageShell>
    </div>
  );
}
