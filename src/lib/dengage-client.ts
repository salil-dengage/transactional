import { env } from "./env";

type CachedToken = {
  token: string;
  expiresAt: number;
  /** Which field in the /login response this came from, for diagnostics. */
  sourceField: string;
};

type AuthMode = "raw" | "bearer";

let tokenCache: CachedToken | null = null;
let inflightLogin: Promise<string> | null = null;
// Start raw (matches Dengage's docs curl); if that trips 401 we'll flip and remember.
let authMode: AuthMode = "raw";

const DEFAULT_TOKEN_TTL_MS = 25 * 60 * 1000;
const SKEW_MS = 30 * 1000;

function extractToken(raw: unknown): { token: string; ttlMs: number; sourceField: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const nested = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  const payload = nested ?? r;

  const tokenCandidates = ["access_token", "accessToken", "token", "jwt", "Token", "AccessToken"];
  for (const k of tokenCandidates) {
    const v = payload[k];
    if (typeof v === "string" && v) {
      const expiresIn = payload.expires_in ?? payload.expiresIn ?? payload.expireIn;
      const ttlSec = typeof expiresIn === "number" ? expiresIn : typeof expiresIn === "string" ? parseInt(expiresIn, 10) : NaN;
      const ttlMs = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec * 1000 : DEFAULT_TOKEN_TTL_MS;
      return { token: v, ttlMs, sourceField: nested ? `data.${k}` : k };
    }
  }
  return null;
}

async function login(): Promise<string> {
  const url = `${env.dengageBaseUrl()}/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      userkey: env.dengageUserkey(),
      password: env.dengagePassword(),
    }),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // leave as raw text
  }

  if (!res.ok) {
    throw new DengageError(`Dengage /login failed: HTTP ${res.status}`, res.status, parsed);
  }

  const extracted = extractToken(parsed);
  if (!extracted) {
    throw new DengageError(
      "Dengage /login succeeded but no recognized token field was found. Inspect the raw response in /api/diagnostics.",
      res.status,
      parsed,
    );
  }

  tokenCache = {
    token: extracted.token,
    expiresAt: Date.now() + extracted.ttlMs - SKEW_MS,
    sourceField: extracted.sourceField,
  };
  return extracted.token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  if (inflightLogin) return inflightLogin;
  inflightLogin = (async () => {
    try {
      return await login();
    } finally {
      inflightLogin = null;
    }
  })();
  return inflightLogin;
}

function authHeader(token: string, mode: AuthMode): string {
  return mode === "bearer" ? `Bearer ${token}` : token;
}

export class DengageError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "DengageError";
    this.status = status;
    this.body = body;
  }
}

export type DengageCallResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  requestUrl: string;
  requestMethod: string;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, string>;
};

export async function callDengage(opts: {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}): Promise<DengageCallResult> {
  const base = env.dengageBaseUrl();
  const pathPart = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  let url = `${base}${pathPart}`;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += (url.includes("?") ? "&" : "?") + s;
  }

  async function doFetch(token: string, mode: AuthMode): Promise<Response> {
    const headers: Record<string, string> = {
      accept: "application/json",
      authorization: authHeader(token, mode),
    };
    const init: RequestInit = { method: opts.method, headers, cache: "no-store" };
    if (opts.body !== undefined && opts.method !== "GET" && opts.method !== "DELETE") {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init);
  }

  const started = Date.now();
  let token = await getToken();
  let res = await doFetch(token, authMode);

  // If auth fails, try the other header format once. Dengage's public docs
  // imply the raw token, but workspaces / versions vary; auto-detecting and
  // caching the winning mode means a presales demo doesn't require a config
  // change to get unblocked.
  if (res.status === 401 || res.status === 403) {
    const otherMode: AuthMode = authMode === "raw" ? "bearer" : "raw";
    const alt = await doFetch(token, otherMode);
    if (alt.status !== 401 && alt.status !== 403) {
      authMode = otherMode;
      res = alt;
    } else {
      // Still unauthorized with either format - try a fresh token on the original mode.
      token = await getToken(true);
      res = await doFetch(token, authMode);
      if (res.status === 401 || res.status === 403) {
        const alt2 = await doFetch(token, otherMode);
        if (alt2.status !== 401 && alt2.status !== 403) {
          authMode = otherMode;
          res = alt2;
        }
      }
    }
  }

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // leave as raw text
  }

  const headersOut: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headersOut[k] = v;
  });

  return {
    ok: res.ok,
    status: res.status,
    durationMs: Date.now() - started,
    requestUrl: url,
    requestMethod: opts.method,
    requestBody: opts.body ?? null,
    responseBody: parsed,
    responseHeaders: headersOut,
  };
}

export async function checkAuth(): Promise<{ ok: boolean; message: string }> {
  try {
    await getToken(true);
    return { ok: true, message: `Login to Dengage succeeded. Token cached. Auth mode: ${authMode}.` };
  } catch (err) {
    if (err instanceof DengageError) {
      return {
        ok: false,
        message: `${err.message}. Response: ${JSON.stringify(err.body).slice(0, 400)}`,
      };
    }
    return { ok: false, message: (err as Error).message };
  }
}

// ----- Diagnostics helpers (consumed by /api/diagnostics) -----

function maskToken(s: string): string {
  if (!s) return "";
  if (s.length <= 12) return `${s.slice(0, 2)}***${s.slice(-2)} (len=${s.length})`;
  return `${s.slice(0, 6)}...${s.slice(-4)} (len=${s.length})`;
}

function redactDeep(obj: unknown): unknown {
  if (typeof obj === "string") return obj;
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactDeep);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if ((lk.includes("token") || lk === "jwt") && typeof v === "string") out[k] = maskToken(v);
    else out[k] = redactDeep(v);
  }
  return out;
}

export async function loginDiagnostic() {
  const url = `${env.dengageBaseUrl()}/login`;
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userkey: env.dengageUserkey(), password: env.dengagePassword() }),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // keep as text
  }
  const extracted = res.ok ? extractToken(parsed) : null;
  return {
    url,
    status: res.status,
    ok: res.ok,
    durationMs: Date.now() - started,
    responseBodyRedacted: redactDeep(parsed),
    tokenExtraction: extracted
      ? {
          found: true,
          sourceField: extracted.sourceField,
          tokenFingerprint: maskToken(extracted.token),
          ttlMs: extracted.ttlMs,
        }
      : { found: false, candidates: ["access_token", "accessToken", "token", "jwt", "Token", "AccessToken"] },
  };
}

export async function authModeProbe(path = "/transactional/email") {
  // Get (or reuse) a token, then hit a simple GET with both auth modes to see
  // which Dengage accepts.
  const token = await getToken();
  const target = `${env.dengageBaseUrl()}${path.startsWith("/") ? path : "/" + path}`;

  async function probe(mode: AuthMode) {
    const started = Date.now();
    const res = await fetch(target, {
      method: "GET",
      headers: { accept: "application/json", authorization: authHeader(token, mode) },
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // raw text
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return {
      mode,
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - started,
      wwwAuthenticate: headers["www-authenticate"] ?? null,
      contentType: headers["content-type"] ?? null,
      responseBodyRedacted: redactDeep(parsed),
    };
  }

  const raw = await probe("raw");
  const bearer = await probe("bearer");
  return { target, token: maskToken(token), raw, bearer };
}

export function currentAuthMode(): AuthMode {
  return authMode;
}
