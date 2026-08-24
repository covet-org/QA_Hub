"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

/** URL-safe key for a group name, e.g. "3.36 Release" -> "3.36-release". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parse(raw: string | null, all: string[]): Set<string> | null {
  if (raw === null) return null; // absent param = everything
  const slugs = new Set(raw.split(",").filter(Boolean));
  return new Set(all.filter((value) => slugs.has(slugify(value))));
}

/**
 * A multi-select filter whose selection lives in the query string, so a
 * filtered view can be refreshed, bookmarked or pasted to a teammate.
 *
 * Writes use history.replaceState rather than the Next router:
 * router.replace would re-run the server component and re-issue the
 * Linear/Testiny queries on every chip click. Filtering happens client
 * side over data already on the page, so the URL is a bookmark, not a
 * fetch trigger.
 *
 * An absent param means "everything selected", which keeps the default
 * view on a clean URL. An empty param means nothing is selected — a real
 * state, reachable by clearing every box.
 */
export function useUrlFilter(
  key: string,
  all: string[],
): {
  selected: Set<string>;
  /** Replace the whole selection — what the FilterGroup component calls. */
  set: (values: string[]) => void;
  toggle: (value: string) => void;
  setAll: () => void;
  clear: () => void;
  isDefault: boolean;
} {
  const params = useSearchParams();
  // Read once at init: identical on the server pass and on hydration, so
  // a shared filtered URL renders correctly without an effect.
  const [selected, setSelected] = useState<Set<string> | null>(() =>
    parse(params.get(key), all),
  );

  const sync = useCallback(
    (next: Set<string> | null) => {
      setSelected(next);
      const search = new URLSearchParams(window.location.search);
      if (next === null) search.delete(key);
      else search.set(key, [...next].map(slugify).join(","));
      const query = search.toString();
      window.history.replaceState(
        null,
        "",
        query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname,
      );
    },
    [key],
  );

  // Memoised so callers can use `selected` as a useMemo dependency.
  const effective = useMemo(() => selected ?? new Set(all), [selected, all]);

  const toggle = useCallback(
    (value: string) => {
      const next = new Set(effective);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      // Back to "everything" collapses to a clean URL.
      sync(next.size === all.length ? null : next);
    },
    [effective, all, sync],
  );

  const set = useCallback(
    (values: string[]) => {
      // Selecting everything collapses back to a clean URL.
      sync(values.length === all.length ? null : new Set(values));
    },
    [all.length, sync],
  );

  return {
    selected: effective,
    set,
    toggle,
    setAll: useCallback(() => sync(null), [sync]),
    clear: useCallback(() => sync(new Set()), [sync]),
    isDefault: selected === null,
  };
}
