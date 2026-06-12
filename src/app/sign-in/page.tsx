import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { env } from "@/lib/env";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <p className="font-display text-2xl font-semibold text-brand-900">
          co<span className="text-accent-400">·</span>vet
        </p>
        <h1 className="mt-6 text-lg font-semibold text-slate-800">QA Brain</h1>
        <p className="mt-1 text-sm text-slate-500">
          Roadmap, effort allocation and testing visibility for the QA
          department.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Sign-in failed. Make sure you use your @{env.allowedEmailDomain}{" "}
            Google account.
          </p>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl ?? "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Restricted to @{env.allowedEmailDomain} accounts
        </p>
      </div>
    </div>
  );
}
