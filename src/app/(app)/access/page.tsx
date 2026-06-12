import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { Tag } from "@/components/Tag";
import { navigation } from "@/config/navigation";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Access" };

export default async function AccessPage() {
  await requireRole("admin");

  return (
    <div>
      <Hero
        kicker="Admin"
        title="Access"
        description="Who can see what. Roles are resolved from environment variables on every request — update them in Vercel and changes apply without redeploying or re-login."
      />
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Current configuration
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-slate-700">Allowed domain</dt>
              <dd className="mt-1 text-slate-500">
                @{env.allowedEmailDomain} — enforced at sign-in; outside
                accounts are rejected.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">
                Admins <span className="font-normal text-slate-400">(QA_ADMIN_EMAILS)</span>
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {env.adminEmails.length > 0 ? (
                  env.adminEmails.map((e) => <Tag key={e}>{e}</Tag>)
                ) : (
                  <span className="text-amber-600">
                    None configured — set QA_ADMIN_EMAILS.
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">
                QA team <span className="font-normal text-slate-400">(QA_TEAM_EMAILS)</span>
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {env.qaTeamEmails.length > 0 ? (
                  env.qaTeamEmails.map((e) => <Tag key={e}>{e}</Tag>)
                ) : (
                  <span className="text-slate-500">
                    None yet — everyone else on the domain is a viewer.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Section visibility
          </h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="text-xs tracking-wide text-slate-400 uppercase">
                <th className="pb-2 font-semibold">Page</th>
                <th className="pb-2 font-semibold">Minimum role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {navigation.flatMap((section) =>
                section.items.map((item) => (
                  <tr key={item.href}>
                    <td className="py-2.5 text-slate-700">
                      {section.title} · {item.label}
                    </td>
                    <td className="py-2.5">
                      <Tag
                        className={
                          item.minRole === "admin"
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : item.minRole === "qa"
                              ? "bg-brand-50 text-brand-700 ring-brand-100"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }
                      >
                        {item.minRole}
                      </Tag>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
