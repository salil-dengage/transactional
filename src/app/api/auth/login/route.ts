import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { issueSessionToken, session } from "@/lib/session";

export const runtime = "nodejs";

// Helper: return a 303 redirect with a RELATIVE Location header.
// Next.js standalone behind a reverse proxy (Fly, etc.) uses the container's
// HOSTNAME env when constructing absolute URLs via NextResponse.redirect,
// which produces Location: http://0.0.0.0:3000/... and breaks the browser.
// A relative Location is resolved by the browser against the current URL,
// so it always lands on the correct public host.
function relativeRedirect(path: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/dashboard");

  const expected = env.portalPassword();
  const ok = password.length === expected.length && timingSafeEqualString(password, expected);

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!ok) {
    const qs = new URLSearchParams({ error: "1" });
    if (safeNext && safeNext !== "/dashboard") qs.set("next", safeNext);
    return relativeRedirect(`/login?${qs.toString()}`);
  }

  const token = issueSessionToken();
  const res = relativeRedirect(safeNext);
  res.cookies.set(session.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAgeSec,
  });
  return res;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
