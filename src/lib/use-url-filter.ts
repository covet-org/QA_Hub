"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { slugify } from "./slug";

export { slugify } from "./slug";

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
 * An absent param means the default selection — everything, unless the
 * caller passes a narrower `defaults`. An empty param means nothing is
 * selected: a real state, reachable by clearing every box.
 *
 * `defaults` exists for lists where "everything" is the wrong opening
 * move. The CS board has a window per release ever shipped; opening on
 * all of them buries the two the team is actually living with.
 */
export function useUrlFilter(
  key: string,
  all: string[],
  defaults?: string[],
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

  // The selection a clean URL means. Keyed by content, not identity:
  // callers build a fresh array every render.
  // Joined keys, not the arrays: hook deps compare by identity and every
  // caller builds these fresh each render.
  const defaultKey = defaults?.join("|") ?? null;
  const allKey = all.join("|");
  const defaultSet = useMemo(() => {
    const key = defaultKey ?? allKey;
    return new Set(key === "" ? [] : key.split("|"));
  }, [defaultKey, allKey]);
  const isDefaultSelection = useCallback(
    (values: string[]) =>
      values.length === defaultSet.size &&
      values.every((v) => defaultSet.has(v)),
    [defaultSet],
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
  const effective = useMemo(
    () => selected ?? defaultSet,
    [selected, defaultSet],
  );

  const toggle = useCallback(
    (value: string) => {
      const next = new Set(effective);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      // Back to the default selection collapses to a clean URL.
      sync(isDefaultSelection([...next]) ? null : next);
    },
    [effective, isDefaultSelection, sync],
  );

  const set = useCallback(
    (values: string[]) => {
      // Landing back on the default collapses to a clean URL.
      sync(isDefaultSelection(values) ? null : new Set(values));
    },
    [isDefaultSelection, sync],
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
