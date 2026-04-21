import { env } from "./env";

type CachedToken = {
  token: string;
  expiresAt: number;
};

let tokenCache: CachedToken | null = null;
let inflightLogin: Promise<string> | null = null;

const DEFAULT_TOKEN_TTL_MS = 25 * 60 * 1000;
const SKEW_MS = 30 * 1000;

function extractToken(raw: unknown): { token: string; ttlMs: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const payload = (r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : r) as Record<string, unknown>;

  const tokenCandidates = ["access_token", "accessToken", "token", "jwt", "Token", "AccessToken"];
  let token: string | undefined;
  for (const k of tokenCandidates) {
    if (typeof payload[k] === "string" && payload[k]) {
      token = payload[k] as string;
      break;
    }
  }
  if (!token) return null;

  const expiresIn = payload.expires_in ?? payload.expiresIn ?? payload.expireIn;
  const ttlSec = typeof expiresIn === "number" ? expiresIn : typeof expiresIn === "string" ? parseInt(expiresIn, 10) : NaN;
  const ttlMs = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec * 1000 : DEFAULT_TOKEN_TTL_MS;

  return { token, ttlMs };
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
    // leave as text
  }

  if (!res.ok) {
    throw new DengageError(
      `Dengage /login failed: HTTP ${res.status}`,
      res.status,
      parsed,
    );
  }

  const extracted = extractToken(parsed);
  if (!extracted) {
    throw new DengageError(
      "Dengage /login succeeded but no token field was found in the response. Inspect the raw response and adjust src/lib/dengage-client.ts if the field name differs.",
      res.status,
      parsed,
    );
  }

  tokenCache = {
    token: extracted.token,
    expiresAt: Date.now() + extracted.ttlMs - SKEW_MS,
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

  async function doFetch(token: string): Promise<Response> {
    const headers: Record<string, string> = {
      accept: "application/json",
      // Dengage expects the raw access token in the Authorization header,
      // NOT "Bearer <token>". Per the docs' sample curl:
      //   --header 'Authorization: {$$.env.access_token}'
      authorization: token,
    };
    const init: RequestInit = {
      method: opts.method,
      headers,
      cache: "no-store",
    };
    if (opts.body !== undefined && opts.method !== "GET" && opts.method !== "DELETE") {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init);
  }

  const started = Date.now();
  let token = await getToken();
  let res = await doFetch(token);

  if (res.status === 401 || res.status === 403) {
    token = await getToken(true);
    res = await doFetch(token);
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
    return { ok: true, message: "Login to Dengage succeeded. Token cached." };
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
