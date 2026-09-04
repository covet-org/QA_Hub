"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { refreshUpstreamData } from "@/lib/refresh-actions";

/**
 * Makes opening or reloading a page mean "go back to the source".
 *
 * Upstream reads are cached for five minutes so that moving between pages
 * does not re-query Linear and Testiny — without that the pages were slow
 * enough to time out. The cost was that a change made in Linear a minute
 * ago stayed invisible however hard anyone pressed reload, and a
 * dashboard that disagrees with the ticket you are looking at is worse
 * than a slow one.
 *
 * So: on any full document load — F5, Cmd-R, a bookmark, the address bar,
 * or arriving from Linear in a new tab — the caches are dropped and the
 * page re-renders. Soft navigation between pages is left alone, which is
 * the case the caches exist for.
 *
 * "reload" alone was too narrow, and narrow in the way that mattered:
 * someone who changes a Testiny result and then opens the hub is on a
 * "navigate", so nothing was revalidated and the page could be five
 * minutes behind the tab they just came from.
 *
 * The first paint still comes from cache, so the page appears immediately
 * and the fresh numbers swap in a moment later; blocking the render on a
 * full round of API calls is the slowness this was built on top of.
 *
 * `router.refresh()` rather than another reload: it re-runs the server
 * components while keeping client state, so filters and open panels
 * survive. And it does not remount this component, which is what stops
 * the two from looping.
 */
export function RefreshOnLoad() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    const [entry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    // A document the viewer actually asked for. "back_forward" is excluded
    // because the browser is restoring a page from history rather than
    // asking for it, and "prerender" is not a viewer at all.
    if (entry?.type !== "reload" && entry?.type !== "navigate") return;

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
