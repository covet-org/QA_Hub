import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/actions";
import { env } from "@/lib/env";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Awaiting approval" };

/** Holding screen for signed-in users whose access is not approved yet. */
export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.kind === "guest") redirect("/sign-in");
  if (viewer.status === "approved") redirect("/");

  const denied = viewer.status === "denied";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <p className="font-display text-2xl font-semibold text-brand-900">
          co<span className="text-accent-400">·</span>vet
        </p>
        <h1 className="mt-6 text-lg font-semibold text-slate-800">
          {denied ? "Access denied" : "Waiting for approval"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {denied ? (
            <>
              Your access request was declined. If you think this is a
              mistake, contact{" "}
              <span className="font-medium text-slate-700">
                {env.notifyEmail}
              </span>
              .
            </>
          ) : (
            <>
              Your request was sent to{" "}
              <span className="font-medium text-slate-700">
                {env.notifyEmail}
              </span>{" "}
              for approval. You&apos;ll get in as soon as it&apos;s accepted —
              try again in a bit.
            </>
          )}
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Signed in as {viewer.email}
        </p>
        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
