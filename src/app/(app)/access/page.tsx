import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { Tag } from "@/components/Tag";
import { listShareLinks, shareableSections } from "@/lib/access/links";
import { type AccessRecord, listAccessRecords } from "@/lib/access/requests";
import { env } from "@/lib/env";
import type { Role } from "@/lib/roles";
import { storeConfigured } from "@/lib/store";
import { requireAccess } from "@/lib/viewer";
import {
  createShareLinkAction,
  decideAccessAction,
  inviteUserAction,
  removeUserAction,
  revokeShareLinkAction,
  setRoleAction,
} from "./actions";

const ROLE_OPTIONS: Role[] = ["viewer", "qa", "admin"];

export const metadata: Metadata = { title: "Access" };

const statusTag: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  denied: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default async function AccessPage() {
  await requireAccess("/access");

  // The store can hit a transient network blip (redis() already retries);
  // if it still fails, show a retry notice instead of a hard 500 page.
  let records: Awaited<ReturnType<typeof listAccessRecords>> = [];
  let links: Awaited<ReturnType<typeof listShareLinks>> = [];
  let storeError = false;
  try {
    [records, links] = await Promise.all([
      listAccessRecords(),
      listShareLinks(),
    ]);
  } catch (error) {
    console.error("Access page store read failed:", error);
    storeError = true;
  }

  const sections = shareableSections();
  const bootstrapSet = new Set(env.adminEmails);
  const pending = records.filter((r) => r.status === "pending");
  const approved = records.filter((r) => r.status === "approved");
  const listed = new Set(approved.map((r) => r.email));
  // Env bootstrap admins are always permitted and cannot be removed.
  const bootstrap: AccessRecord[] = env.adminEmails
    .filter((e) => !listed.has(e))
    .map((email) => ({
      email,
      name: "",
      status: "approved",
      role: "admin",
      requestedAt: "",
    }));
  const permitted = [...bootstrap, ...approved].sort((a, b) =>
    a.email.localeCompare(b.email),
  );

  return (
    <div>
      <Hero
        kicker="Admin"
        title="Access"
        description="Approve sign-in requests, manage roles and create shareable links with custom per-section permissions. Requests email you at sign-in time; everything here applies immediately."
      />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] -mt-11 space-y-4 px-6 pb-12 sm:px-8">
        {storeError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            <span className="font-semibold">Couldn&apos;t reach the store.</span>{" "}
            A temporary connection issue prevented loading requests and links.
            Refresh to try again.
          </div>
        )}
        {!storeConfigured() && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <span className="font-semibold">Local storage mode.</span> Access
            requests and share links are stored in a local file. Provision
            Upstash Redis (Vercel Marketplace) and set{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px]">
              UPSTASH_REDIS_REST_URL/TOKEN
            </code>{" "}
            before deploying.
          </div>
        )}

        {/* ── Pending requests ────────────────────────────────── */}
        {pending.length > 0 && (
          <section className="rounded-xl bg-surface-card p-5 shadow-card ring-1 ring-hairline">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
              Pending requests
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              People who signed in and are waiting for access. Approving adds
              them to the permitted list below.
            </p>
            <ul className="mt-4 divide-y divide-hairline">
              {pending.map((r) => (
                <li
                  key={r.email}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">
                      {r.name || r.email}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.email} · requested{" "}
                      {r.requestedAt
                        ? new Date(r.requestedAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <form action={decideAccessAction} className="flex gap-2">
                    <input type="hidden" name="email" value={r.email} />
                    <select
                      name="role"
                      defaultValue="viewer"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-700"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      name="action"
                      value="approve"
                      className="rounded-lg bg-brand-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="action"
                      value="deny"
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                    >
                      Deny
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Permitted users ─────────────────────────────────── */}
        <section className="rounded-xl bg-surface-card p-5 shadow-card ring-1 ring-hairline">
          <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
            Permitted users
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Everyone allowed into QA Brain. Change a role or revoke access —
            changes apply immediately.
          </p>

          {/* Invite */}
          <form
            action={inviteUserAction}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-hairline"
          >
            <label className="flex-1 text-[11px] font-medium text-slate-600">
              Invite by email
              <input
                name="email"
                type="email"
                required
                placeholder={`name@${env.allowedEmailDomain}`}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Role
              <select
                name="role"
                defaultValue="viewer"
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
            >
              Invite
            </button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">
            Invited users are pre-approved and emailed a sign-in link. Only
            @{env.allowedEmailDomain} addresses can actually sign in.
          </p>

          <ul className="mt-4 divide-y divide-hairline">
            {permitted.map((r) => {
              const isBootstrap = bootstrapSet.has(r.email);
              const notYet = r.invited && !r.signedIn;
              return (
                <li
                  key={r.email}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">
                      {r.name || r.email}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.email}
                      {isBootstrap && " · bootstrap admin (env)"}
                    </p>
                  </div>
                  {notYet && (
                    <Tag className="bg-sky-50 text-sky-700 ring-sky-200">
                      invited
                    </Tag>
                  )}
                  {isBootstrap ? (
                    <Tag className="bg-rose-50 text-rose-700 ring-rose-200">
                      admin
                    </Tag>
                  ) : (
                    <>
                      <form action={setRoleAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="email" value={r.email} />
                        <select
                          name="role"
                          defaultValue={r.role}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-700"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Set
                        </button>
                      </form>
                      <form action={removeUserAction}>
                        <input type="hidden" name="email" value={r.email} />
                        <button
                          type="submit"
                          className="text-[11px] font-medium text-rose-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Share links ─────────────────────────────────────── */}
        <section className="rounded-xl bg-surface-card p-5 shadow-card ring-1 ring-hairline">
          <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
            Share links
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Anyone with a link browses the selected sections as a guest — no
            Google account needed. Revoking cuts off existing visitors
            immediately.
          </p>

          <form
            action={createShareLinkAction}
            className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-hairline"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex-1 text-[11px] font-medium text-slate-600">
                Label
                <input
                  name="label"
                  required
                  placeholder="e.g. Leadership review"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Expires (days)
                <input
                  name="expiresDays"
                  type="number"
                  min="1"
                  placeholder="never"
                  className="mt-1 w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800"
                />
              </label>
            </div>
            <fieldset className="mt-3">
              <legend className="text-[11px] font-medium text-slate-600">
                Sections this link unlocks
              </legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {sections.map((s) => (
                  <label
                    key={s.href}
                    className="flex items-center gap-1.5 text-[13px] text-slate-700"
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
              className="mt-4 rounded-lg bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
            >
              Create link
            </button>
          </form>

          {links.length > 0 && (
            <ul className="mt-5 divide-y divide-hairline">
              {links.map((link) => {
                const url = `${env.appUrl}/share/${link.id}`;
                const expired = link.expired;
                return (
                  <li key={link.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-800">
                          {link.label}
                        </p>
                        <p className="truncate font-mono text-[11px] text-brand-700 select-all">
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
                            className="text-[11px] font-medium text-rose-600 hover:underline"
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
        <section className="rounded-xl bg-surface-card p-5 shadow-card ring-1 ring-hairline">
          <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
            Base configuration
          </h2>
          <dl className="mt-4 space-y-3 text-[13px]">
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
