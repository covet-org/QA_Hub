import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Compact HMAC-signed tokens (payload.signature, base64url) used for
 * one-click approve/deny email links and the share-link cookie.
 * Signed with AUTH_SECRET — rotating it invalidates all outstanding tokens.
 */

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required for signed tokens");
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signToken(
  payload: Record<string, unknown>,
  expiresInSeconds: number,
): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyToken<T extends { exp: number }>(
  token: string,
): T | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as T;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
