"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { refreshUpstreamData } from "@/lib/refresh-actions";

/**
 * Makes a reload mean "go back to the source".
 *
 * Upstream reads are cached for five minutes so that moving between pages
 * does not re-query Linear and Testiny — without that the pages were slow
 * enough to time out. The cost was that a change made in Linear a minute
 * ago stayed invisible however hard anyone pressed reload, and a
 * dashboard that disagrees with the ticket you are looking at is worse
 * than a slow one.
 *
 * So: on a real reload (F5, Cmd-R, the address bar — not a click through
 * the app) the caches are dropped and the page re-renders. The first paint
 * still comes from cache, so the page appears immediately and the fresh
 * numbers swap in a moment later; the alternative, blocking the render on
 * a full round of API calls, is the slowness this was fixing.
 *
 * `router.refresh()` rather than another reload: it re-runs the server
 * components while keeping client state, so filters and open panels
 * survive. And it does not remount this component, which is what stops
 * the two from looping.
 */
export function RefreshOnReload() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    const [entry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    // Only a genuine reload. A soft navigation is exactly the case the
    // caches exist for, and "prerender" is not a viewer at all.
    if (entry?.type !== "reload") return;

    started.current = true;
    void refreshUpstreamData()
      .then(() => router.refresh())
      .catch(() => {
        // A failed revalidation leaves the cached page on screen, which is
        // the same thing the viewer would have got before this existed.
      });
  }, [router]);

  return null;
}
