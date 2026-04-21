import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  "/favicon.ico",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next/") || pathname.startsWith("/static/")) {
    return NextResponse.next();
  }

  // Edge middleware can't verify HMAC signatures with node:crypto. It only
  // checks cookie presence for redirect flow; API routes and pages re-verify
  // the signature on the Node runtime via verifySessionToken().
  const cookie = req.cookies.get("portal_session")?.value;
  if (!cookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
