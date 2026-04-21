import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { issueSessionToken, session } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") || "");
  const next = String(form.get("next") || "/dashboard");

  const expected = env.portalPassword();
  const ok = password.length === expected.length && timingSafeEqualString(password, expected);

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!ok) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    if (safeNext && safeNext !== "/dashboard") url.searchParams.set("next", safeNext);
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = issueSessionToken();
  const res = NextResponse.redirect(new URL(safeNext, req.url), { status: 303 });
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
