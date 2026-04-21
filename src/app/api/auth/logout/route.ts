import { NextRequest, NextResponse } from "next/server";
import { session } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  // Relative Location so it resolves against the public host (see login route).
  const res = new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  res.cookies.set(session.cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
