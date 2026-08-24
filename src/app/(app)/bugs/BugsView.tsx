import { BugBoard } from "@/components/BugBoard";
import { Hero } from "@/components/Hero";
import { getBugsSnapshot, type BugKind } from "@/lib/bugs";
import { env } from "@/lib/env";
import { requireAccess } from "@/lib/viewer";

/** Shared server view for the Bugs / CS Bugs pages. */
export async function BugsView({ kind }: { kind: BugKind }) {
  await requireAccess("/bugs");
  const snapshot = await getBugsSnapshot(kind);
  const isCs = kind === "cs";
  const label = isCs ? env.csBugLabel : env.bugLabel;

  return (
    <div>
      <Hero
        kicker={`Bugs · ${isCs ? "Customer Support" : "Product"}`}
        title={isCs ? "CS Bugs" : "Bugs"}
        description={`Linear tickets labeled "${label}", grouped by release. Lands on the releases still in testing — switch to closed releases for the shipped history.`}
        footnote="Linear · active releases derived from open Testiny runs"
      />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
        {snapshot.isSample && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <span className="font-semibold">Linear not connected.</span> Set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px]">
              LINEAR_API_KEY
            </code>{" "}
            to list bugs.
          </div>
        )}

        <BugBoard groups={snapshot.groups} />
      </div>
    </div>
  );
}
