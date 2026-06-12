import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { Tag } from "@/components/Tag";
import { listShareLinks, shareableSections } from "@/lib/access/links";
import { listAccessRecords } from "@/lib/access/requests";
import { env } from "@/lib/env";
import { storeConfigured } from "@/lib/store";
import { requireAccess } from "@/lib/viewer";
import {
  createShareLinkAction,
  decideAccessAction,
  revokeShareLinkAction,
} from "./actions";

export const metadata: Metadata = { title: "Access" };

const statusTag: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  denied: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function AccessPage() {
  await requireAccess("/access");
  const [records, links] = await Promise.all([
    listAccessRecords(),
    listShareLinks(),
  ]);
  const sections = shareableSections();
  const pending = records.filter((r) => r.status === "pending");
  const decided = records.filter((r) => r.status !== "pending");

  return (
    <div>
      <Hero
        kicker="Admin"
        title="Access"
        description="Approve sign-in requests, manage roles and create shareable links with custom per-section permissions. Requests email you at sign-in time; everything here applies immediately."
      />
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-10">
        {!storeConfigured() && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Local storage mode.</span> Access
            requests and share links are stored in a local file. Provision
            Upstash Redis (Vercel Marketplace) and set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[12px]">
              UPSTASH_REDIS_REST_URL/TOKEN
            </code>{" "}
            before deploying.
          </div>
        )}

        {/* ── Access requests ─────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Access requests
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign-in attempts wait here (and in your inbox at{" "}
            {env.notifyEmail}) until you decide.
          </p>

          {pending.length === 0 && decided.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              No requests yet. They appear the first time someone signs in.
            </p>
          )}

          {pending.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {pending.map((r) => (
                <li
                  key={r.email}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {r.name || r.email}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {r.email} · requested{" "}
                      {new Date(r.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <Tag className={statusTag[r.status]}>{r.status}</Tag>
                  <form action={decideAccessAction} className="flex gap-2">
                    <input type="hidden" name="email" value={r.email} />
                    <select
                      name="role"
                      defaultValue="viewer"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="viewer">viewer</option>
                      <option value="qa">qa</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="submit"
                      name="action"
                      value="approve"
                      className="rounded-lg bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="deny"
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                    >
                      Deny
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {decided.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">
                Decided ({decided.length})
              </summary>
              <ul className="mt-2 divide-y divide-slate-100">
                {decided.map((r) => (
                  <li
                    key={r.email}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">
                        {r.name || r.email}{" "}
                        <span className="text-xs text-slate-400">
                          {r.email}
                        </span>
                      </p>
                    </div>
                    <Tag>{r.role}</Tag>
                    <Tag className={statusTag[r.status]}>{r.status}</Tag>
                    <form action={decideAccessAction} className="flex gap-2">
                      <input type="hidden" name="email" value={r.email} />
                      <input type="hidden" name="role" value={r.role} />
                      {r.status === "denied" ? (
                        <button
                          type="submit"
                          name="action"
                          value="approve"
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          type="submit"
                          name="action"
                          value="deny"
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* ── Share links ─────────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Share links
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Anyone with a link browses the selected sections as a guest — no
            Google account needed. Revoking cuts off existing visitors
            immediately.
          </p>

          <form
            action={createShareLinkAction}
            className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 text-xs font-medium text-slate-600">
                Label
                <input
                  name="label"
                  required
                  placeholder="e.g. Leadership review"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Expires (days)
                <input
                  name="expiresDays"
                  type="number"
                  min="1"
                  placeholder="never"
                  className="mt-1 w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </label>
            </div>
            <fieldset className="mt-3">
              <legend className="text-xs font-medium text-slate-600">
                Sections this link unlocks
              </legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {sections.map((s) => (
                  <label
                    key={s.href}
                    className="flex items-center gap-1.5 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="sections"
                      value={s.href}
                      className="size-4 accent-brand-700"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Create link
            </button>
          </form>

          {links.length > 0 && (
            <ul className="mt-5 divide-y divide-slate-100">
              {links.map((link) => {
                const url = `${env.appUrl}/share/${link.id}`;
                const expired = link.expired;
                return (
                  <li key={link.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {link.label}
                        </p>
                        <p className="truncate font-mono text-xs text-brand-700 select-all">
                          {url}
                        </p>
                      </div>
                      {link.revoked ? (
                        <Tag className={statusTag.denied}>revoked</Tag>
                      ) : expired ? (
                        <Tag>expired</Tag>
                      ) : (
                        <Tag className={statusTag.approved}>active</Tag>
                      )}
                      {!link.revoked && !expired && (
                        <form action={revokeShareLinkAction}>
                          <input type="hidden" name="id" value={link.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-rose-600 hover:underline"
                          >
                            Revoke
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {link.sections.map((s) => (
                        <Tag key={s} className="bg-brand-50 text-brand-700 ring-brand-100">
                          {sections.find((x) => x.href === s)?.label ?? s}
                        </Tag>
                      ))}
                      {link.expiresAt && !expired && (
                        <Tag>
                          expires {new Date(link.expiresAt).toLocaleDateString()}
                        </Tag>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Static config ───────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Base configuration
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-slate-700">Allowed domain</dt>
              <dd className="mt-0.5 text-slate-500">
                @{env.allowedEmailDomain} — outside accounts can&apos;t sign in
                with Google (use share links for externals).
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">
                Admins{" "}
                <span className="font-normal text-slate-400">
                  (QA_ADMIN_EMAILS — auto-approved, receive requests)
                </span>
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {env.adminEmails.map((e) => (
                  <Tag key={e}>{e}</Tag>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Notifications to</dt>
              <dd className="mt-0.5 text-slate-500">{env.notifyEmail}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
