"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { refreshUpstreamData } from "@/lib/refresh-actions";

/** How often the numbers on screen go back to the source. */
export const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/** How often we check whether that interval has elapsed. */
const TICK_MS = 60 * 1000;

/**
 * Keeps an open tab's numbers current without anyone pressing reload.
 *
 * A QA dashboard gets left open on a second monitor all day, and every
 * figure on it was true only at page load. This calls router.refresh(),
 * which re-runs the server components and swaps in fresh data while
 * preserving client state — so a filter selection, an open disclosure or
 * a pinned chart readout survives the refresh. A full reload would throw
 * all three away, which is why this is not just location.reload().
 *
 * Hidden tabs are skipped rather than refreshed: a background tab that
 * nobody is reading still costs a full server render and its upstream
 * Linear and Testiny requests. On becoming visible again the check runs
 * immediately, so returning to a tab left overnight shows current
 * numbers rather than yesterday's plus a wait.
 */
export function AutoRefresh({
  intervalMs = REFRESH_INTERVAL_MS,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  // Stamped on mount inside the effect, not at render: reading the clock
  // during render is impure and the lint rule is right to refuse it.
  const lastRefresh = useRef(0);

  useEffect(() => {
    if (lastRefresh.current === 0) lastRefresh.current = Date.now();

    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current < intervalMs) return;
      lastRefresh.current = Date.now();
      // Drop the upstream caches first. router.refresh() alone re-renders
      // against them, so a tab left open could sit a cache window behind
      // on top of this interval — and the tooltip below promises otherwise.
      void refreshUpstreamData()
        .then(() => router.refresh())
        .catch(() => router.refresh());
    };

    const timer = setInterval(maybeRefresh, TICK_MS);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [router, intervalMs]);

  return null;
}

/**
 * When the data on screen was read, in the reader's own clock.
 *
 * Rendered on the server and therefore replaced on every refresh, which
 * makes it the honest answer to "is this current?" — the one question a
 * dashboard that updates itself invites.
 */
export function DataTimestamp({ isoTime }: { isoTime: string }) {
  // Formatted during render, not in an effect. The server has no idea what
  // timezone the reader is in, so this string differs between the server
  // pass and hydration by design — which is exactly what
  // suppressHydrationWarning is for. Deriving it in an effect instead
  // would mean a setState on every render pass and a flash of no time.
  const label = new Date(isoTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <p
      suppressHydrationWarning
      className="mt-2 text-[10px] text-brand-100/45"
      title="These numbers go back to Linear and Testiny every 30 minutes, and whenever you reload the page"
    >
      Data as of {label} · auto-refreshes
    </p>
  );
}

/**
 * Pull new data now, without reloading the page.
 *
 * Sits beside the timestamp because that is where the question "is this
 * current?" gets asked. Automatic revalidation on page load covers the
 * common case, but a viewer who has just changed something in Linear or
 * Testiny and is already looking at the hub should not have to guess how
 * the browser classified their navigation.
 *
 * router.refresh() keeps client state, so filters and open panels survive
 * — which is the whole reason this is a button and not a reload link.
 */
export function RefreshDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await refreshUpstreamData();
          router.refresh();
        })
      }
      className="mt-1 text-[10px] text-brand-100/60 underline-offset-2 transition-colors hover:text-white hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
      title="Re-read Linear and Testiny now, keeping your filters"
    >
      {pending ? "Refreshing…" : "Refresh now"}
    </button>
  );
}
