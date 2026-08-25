import type { Metadata } from "next";
import { InitiativeList } from "@/components/InitiativeList";
import { initiatives } from "@/content/initiatives";
import { getAutomationStatus } from "@/lib/automation/provider";
import { requireAccess } from "@/lib/viewer";
import {
  PageHeader,
  PageShell,
  Tag,
  UnderDevelopment,
} from "@/components/ui";

export const metadata: Metadata = { title: "Automation" };

export default async function AutomationPage() {
  await requireAccess("/automation");
  const status = await getAutomationStatus();

  const automationInitiatives = initiatives.filter(
    (i) => i.effort.automation > 0,
  );

  return (
    <div>
      <PageHeader
        kicker="Testing · Automation"
        title="Automation"
        description="Where test automation stands today and where it's headed. Suite results will appear here automatically once the CI provider is connected."
      >
        <Tag className="bg-white/10 text-accent-300 ring-white/20">
          {status.available ? "CI connected" : "Phase 2 — CI not connected yet"}
        </Tag>
      </PageHeader>

      <UnderDevelopment>
        <PageShell>
          {!status.available && (
            <section className="rounded-xl border border-dashed border-brand-600/30 bg-brand-50 p-6">
              <h2 className="font-display text-base font-semibold text-brand-900">
                Suite results land here
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600">
                When the automated suite ships, implement{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-[11px] ring-1 ring-hairline">
                  AutomationProvider
                </code>{" "}
                in{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-[11px] ring-1 ring-hairline">
                  src/lib/automation/provider.ts
                </code>{" "}
                against the CI results source (Playwright report, GitHub Actions
                artifact or a pushed JSON). This page renders pass rates and
                durations per suite with no further UI work.
              </p>
            </section>
          )}

          <section>
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
              Automation roadmap
            </h2>
            <p className="mt-1 mb-5 text-[13px] text-slate-500">
              Initiatives with an automation share of the effort split.
            </p>
            <InitiativeList initiatives={automationInitiatives} />
          </section>
        </PageShell>
      </UnderDevelopment>
    </div>
  );
}
