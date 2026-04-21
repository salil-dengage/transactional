import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

const COOKIE_NAME = "portal_session";
const MAX_AGE_SEC = 60 * 60 * 12;

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", env.sessionSecret()).update(payload).digest());
}

export function issueSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = b64url(JSON.stringify({ exp }));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as { exp?: number };
    if (!data.exp || typeof data.exp !== "number") return false;
    if (Math.floor(Date.now() / 1000) > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export const session = {
  cookieName: COOKIE_NAME,
  maxAgeSec: MAX_AGE_SEC,
};
