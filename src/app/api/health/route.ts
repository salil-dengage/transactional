import { NextResponse } from "next/server";

// Dependency-free health check for Fly / any infra. Intentionally does NOT
// call Dengage or require env vars so deploys aren't blocked before secrets
// are configured.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ ok: true, service: "dengage-api-showcase" });
}
