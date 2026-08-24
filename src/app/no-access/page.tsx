import type { Metadata } from "next";
import { signOutAction } from "@/lib/actions";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "No access" };

/**
 * Shown to a signed-in account that is on QA_BLOCKED_EMAILS. Everyone
 * else on the domain is admitted, so reaching this page is deliberate.
 */
export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md rounded-xl bg-surface-card p-6 text-center shadow-card ring-1 ring-hairline">
        <p className="font-display text-lg font-semibold text-brand-800">
          co<span className="text-accent-400">·</span>vet{" "}
          <span className="font-normal text-slate-500">QA Brain</span>
        </p>
        <h1 className="font-display mt-4 text-xl font-semibold text-slate-800">
          Access removed
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          This account has been blocked from QA Brain. If that looks wrong,
          ask a QA lead at{" "}
          <a
            href={`mailto:${env.notifyEmail}`}
            className="text-brand-700 hover:underline"
          >
            {env.notifyEmail}
          </a>{" "}
          to remove it from the blocked list.
        </p>
        <form action={signOutAction} className="mt-5">
          <button
            type="submit"
            className="rounded-lg bg-brand-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
