import { unstable_cache } from "next/cache";

import { env } from "@/lib/env";
import type { TestinyFindResponse } from "@/lib/testiny/types";

const BASE_URL = "https://app.testiny.io/api/v1";

/** How long Testiny responses are cached server-side (seconds). */
export const TESTINY_REVALIDATE_SECONDS = 300;

export class TestinyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TestinyError";
  }
}

export function testinyConfigured(): boolean {
  return Boolean(env.testinyApiKey);
}

/** A `map` join expression — expands mapping relationships in /find results. */
export interface MapJoin {
  entities?: string[];
  entity?: string;
  idOnly?: boolean;
  result?: string;
  /** Include mapping rows whose member entities were soft-deleted. */
  includeDeleted?: boolean;
}

interface FindOptions {
  filter?: Record<string, unknown>;
  ids?: number[];
  map?: MapJoin | MapJoin[];
  omitLargeValues?: boolean;
  /** Include soft-deleted entities in the result. */
  includeDeleted?: boolean;
  pagination?: { offset: number; limit: number };
  includeTotalCount?: boolean;
}

/**
 * POST /{entity}/find — Testiny's filtered query endpoint.
 * NOT cached by `next: { revalidate }` below — Testiny's API is POST-only
 * and Next caches GETs. Cross-request caching comes from
 * findAllEntitiesCached, which every caller should use.
 */
export async function findEntities<T>(
  entity: string,
  options: FindOptions = {},
): Promise<TestinyFindResponse<T>> {
  const apiKey = env.testinyApiKey;
  if (!apiKey) {
    throw new TestinyError("TESTINY_API_KEY is not configured");
  }

  const res = await fetch(`${BASE_URL}/${entity}/find`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      omitLargeValues: true,
      pagination: { offset: 0, limit: 500 },
      includeTotalCount: true,
      ...options,
    }),
    next: { revalidate: TESTINY_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new TestinyError(
      `Testiny ${entity}/find failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  return (await res.json()) as TestinyFindResponse<T>;
}

/** Fetch every page of a /find query. */
export async function findAllEntities<T>(
  entity: string,
  options: Omit<FindOptions, "pagination"> = {},
): Promise<T[]> {
  const pageSize = 500;
  const all: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await findEntities<T>(entity, {
      ...options,
      pagination: { offset, limit: pageSize },
    });
    all.push(...page.data);
    if (page.data.length < pageSize) break;
  }
  return all;
}

/**
 * Key that survives a round trip and does not depend on property order, so
 * two callers writing the same filter differently still share one entry.
 */
function stableKey(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableKey(v)}`);
  return `{${entries.join(",")}}`;
}

const cachedFindAll = unstable_cache(
  async (entity: string, optionsKey: string): Promise<unknown[]> =>
    findAllEntities<unknown>(entity, JSON.parse(optionsKey) as FindOptions),
  ["testiny-find-all"],
  { revalidate: TESTINY_REVALIDATE_SECONDS },
);

/**
 * findAllEntities, reused across requests for TESTINY_REVALIDATE_SECONDS.
 *
 * This is the one every caller should use. Without it each navigation
 * re-pulled the same pages — the coverage index fetches every test case in
 * the project, and a closed run’s results never change — which is what made
 * moving between pages cost a full round of API calls.
 */
export async function findAllEntitiesCached<T>(
  entity: string,
  options: Omit<FindOptions, "pagination"> = {},
): Promise<T[]> {
  return (await cachedFindAll(entity, stableKey(options))) as T[];
}
