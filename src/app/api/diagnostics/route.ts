import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authModeProbe, currentAuthMode, loginDiagnostic } from "@/lib/dengage-client";
import { env } from "@/lib/env";
import { session, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const t = cookies().get(session.cookieName)?.value;
  if (!verifySessionToken(t)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = {
    dengageBaseUrl: env.dengageBaseUrl(),
    dengageUserkeyFingerprint: env.dengageUserkey().slice(0, 4) + "***" + env.dengageUserkey().slice(-2),
    currentAuthMode: currentAuthMode(),
  };

  // 1. Hit /login directly and report the shape (token value redacted).
  try {
    out.login = await loginDiagnostic();
  } catch (e) {
    out.login = { error: (e as Error).message };
  }

  // 2. Probe the template-list endpoint with BOTH auth-header formats.
  //    Whichever returns non-401 is the winner.
  try {
    out.authProbe = await authModeProbe("/transactional/email");
  } catch (e) {
    out.authProbe = { error: (e as Error).message };
  }

  // 3. Outbound IP (what Dengage sees for whitelisting).
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    out.outboundIp = (await res.json()) as unknown;
  } catch (e) {
    out.outboundIp = { error: (e as Error).message };
  }

  return NextResponse.json(out, { status: 200 });
}
