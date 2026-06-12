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
 * Responses are cached by Next.js for TESTINY_REVALIDATE_SECONDS.
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
