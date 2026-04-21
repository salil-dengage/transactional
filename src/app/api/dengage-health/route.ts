import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkAuth } from "@/lib/dengage-client";
import { session, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const token = cookies().get(session.cookieName)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await checkAuth();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
