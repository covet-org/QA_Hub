import "server-only";

import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny key-value store used for access requests and share links.
 *
 * Production: Upstash Redis via its REST API (provision through the
 * Vercel Marketplace; set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 * Development fallback: a JSON file under .data/ (gitignored) so the
 * whole flow works locally with zero provisioning.
 */

interface UpstashConfig {
  url: string;
  token: string;
}

function upstashConfig(): UpstashConfig | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** Small sleep helper for retry backoff. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redis(
  config: UpstashConfig,
  command: (string | number)[],
): Promise<unknown> {
  // Retry transient failures — serverless functions occasionally hit a
  // DNS/connection blip reaching Upstash (fetch failed / ENOTFOUND) or a
  // 5xx; a single blip should not 500 the page.
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        cache: "no-store",
      });
      if (res.status >= 500) {
        throw new Error(`Store request failed: ${res.status} ${res.statusText}`);
      }
      if (!res.ok) {
        // 4xx is a real error (bad auth/command) — don't retry.
        throw new Error(`Store request failed: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { result: unknown; error?: string };
      if (json.error) throw new Error(`Store error: ${json.error}`);
      return json.result;
    } catch (error) {
      lastError = error;
      const status = error instanceof Error ? error.message : "";
      // Only retry transient network / 5xx failures, not 4xx.
      const retryable =
        !status.includes(" 4") /* 4xx status */ && attempt < maxAttempts;
      if (!retryable) break;
      await delay(150 * attempt);
    }
  }
  throw lastError;
}

// ── Local file fallback (dev only) ───────────────────────────────

const LOCAL_STORE = path.join(process.cwd(), ".data", "store.json");

async function readLocal(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fs.readFile(LOCAL_STORE, "utf8"));
  } catch {
    return {};
  }
}

async function writeLocal(data: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_STORE), { recursive: true });
  await fs.writeFile(LOCAL_STORE, JSON.stringify(data, null, 2), "utf8");
}

// ── Public API ───────────────────────────────────────────────────

export function storeConfigured(): boolean {
  return upstashConfig() !== null;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const config = upstashConfig();
  const raw = config
    ? ((await redis(config, ["GET", key])) as string | null)
    : ((await readLocal())[key] ?? null);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  const config = upstashConfig();
  if (config) {
    await redis(config, ["SET", key, json]);
  } else {
    const data = await readLocal();
    data[key] = json;
    await writeLocal(data);
  }
}

export async function kvDelete(key: string): Promise<void> {
  const config = upstashConfig();
  if (config) {
    await redis(config, ["DEL", key]);
  } else {
    const data = await readLocal();
    delete data[key];
    await writeLocal(data);
  }
}

/** List values for all keys matching `prefix*`. Volumes here are tiny. */
export async function kvList<T>(prefix: string): Promise<T[]> {
  const config = upstashConfig();
  if (config) {
    const keys = (await redis(config, ["KEYS", `${prefix}*`])) as string[];
    if (keys.length === 0) return [];
    const values = (await redis(config, ["MGET", ...keys])) as (string | null)[];
    return values.filter((v): v is string => v !== null).map((v) => JSON.parse(v) as T);
  }
  const data = await readLocal();
  return Object.entries(data)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => JSON.parse(v) as T);
}
