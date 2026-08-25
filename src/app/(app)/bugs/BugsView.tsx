import { BugBoard } from "@/components/BugBoard";
import {
  CS_UNATTRIBUTED,
  getBugsSnapshot,
  getCsBugBoard,
  type BugKind,
} from "@/lib/bugs";
import { env } from "@/lib/env";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell } from "@/components/ui";

/** Shared server view for the Bugs / CS Bugs pages. */
export async function BugsView({ kind }: { kind: BugKind }) {
  await requireAccess("/bugs");
  const isCs = kind === "cs";
  const label = isCs ? env.csBugLabel : env.bugLabel;
  // CS bugs are grouped by which release was in production when they
  // arrived — the same attribution the Home chart draws. Product bugs
  // carry their release on the ticket, so they keep their own grouping.
  const snapshot = isCs ? await getCsBugBoard() : await getBugsSnapshot(kind);

  return (
    <div>
      <PageHeader
        kicker={`Bugs · ${isCs ? "Customer Support" : "Product"}`}
        title={isCs ? "CS Bugs" : "Bugs"}
        description={
          isCs
            ? `Every Linear ticket labeled "${label}", grouped by the release that was in production when it arrived — a release owns production from its go-live until the next release's. Opens on the last two releases; use + More for older ones.`
            : `Linear tickets labeled "${label}", grouped by release. Lands on the releases still in testing — switch to closed releases for the shipped history.`
        }
        footnote={
          isCs
            ? `Linear · go-live from the production release pipeline · ${CS_UNATTRIBUTED} holds bugs filed before the earliest known go-live`
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

        {isCs ? (
          <BugBoard
            groups={snapshot.groups}
            revealAfter={2}
            pinned={[CS_UNATTRIBUTED]}
          />
        ) : (
          <BugBoard groups={snapshot.groups} />
        )}
      </PageShell>
    </div>
  );
}
