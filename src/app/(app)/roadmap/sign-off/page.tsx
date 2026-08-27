import type { Metadata } from "next";
import { SignOffBoard } from "@/components/SignOffBoard";
import { env } from "@/lib/env";
import { getSignOffSnapshot } from "@/lib/linear/sign-off";
import { countByState, STATE_LABEL } from "@/lib/sign-off";
import { requireAccess } from "@/lib/viewer";
import { PageHeader, PageShell } from "@/components/ui";

export const metadata: Metadata = { title: "Design Sign-off" };

/**
 * The design gate for Cross-Product stories: reached "Merged to dev" in
 * Linear AND presented in writing in the squad's Slack channel.
 *
 * The Slack half is read from Linear attachments, so this board only knows
 * what the Slack-to-Linear sync has recorded. Stories merged before the
 * sync began are marked as such rather than counted as failures — that
 * distinction is the whole reason the board is trustworthy.
 */
export default async function SignOffPage() {
  await requireAccess("/roadmap");
  const { rows, isSample, error } = await getSignOffSnapshot();
  const counts = countByState(rows);
  const channel = env.signOffSlackChannelName;

  return (
    <div>
      <PageHeader
        kicker="Roadmap · Design Sign-off"
        title="Design Sign-off"
        description={`Medium/Big features and Quick wins in ${env.signOffProject}. A story is through the gate when it has reached "${env.signOffMergedStatus}" in Linear and a thread from #${channel} is linked to it. Stories merged with no linked thread lead the board.`}
        footnote={
          counts.length > 0
            ? counts
                .map(({ state, count }) => `${count} ${STATE_LABEL[state]}`)
                .join(" · ")
            : "Linear · Slack confirmation read from issue attachments"
        }
      />
      <PageShell>
        {isSample && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <span className="font-semibold">Linear not connected.</span> Set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px]">
              LINEAR_API_KEY
            </code>{" "}
            to read the sign-off gate.
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            <span className="font-semibold">Gate not readable.</span> {error} —
            an empty board here would read as &ldquo;nothing to sign off&rdquo;,
            which is not what this means.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-surface-sunken px-4 py-3 text-[12px] text-slate-600">
          <span className="font-semibold text-slate-700">
            What counts as confirmation:
          </span>{" "}
          a Slack thread from <span className="font-medium">#{channel}</span>{" "}
          linked to the Linear issue, which is what the Slack integration
          records as an attachment. Threads shared from other channels do not
          count. Stories merged before {env.signOffSyncSince} predate the sync
          and are reported as such rather than as missing sign-off.
        </div>

        <SignOffBoard rows={rows} channelName={channel} />
      </PageShell>
    </div>
  );
}
