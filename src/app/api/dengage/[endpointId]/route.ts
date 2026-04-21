import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEndpoint } from "@/lib/dengage-registry";
import { callDengage } from "@/lib/dengage-client";
import { session, verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { endpointId: string } },
) {
  const token = cookies().get(session.cookieName)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const endpoint = getEndpoint(params.endpointId);
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint not found" }, { status: 404 });
  }

  let body: { payload?: unknown };
  try {
    body = (await req.json()) as { payload?: unknown };
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }

  try {
    // For GET/DELETE, Dengage takes filters in the query string, not a body.
    // Route the form payload accordingly so BeginTime/EndTime (and any other
    // GET filters on future endpoints) actually reach the server.
    // Endpoint-specific transforms (merge-tag substitution for raw HTML,
    // flat -> nested bulk shape, etc.) run here via the registry hook.
    const payload = endpoint.transformPayload
      ? endpoint.transformPayload(body.payload)
      : body.payload;
    const isBodylessMethod = endpoint.method === "GET" || endpoint.method === "DELETE";
    const query =
      isBodylessMethod && payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, string | number | boolean | undefined>)
        : undefined;

    const result = await callDengage({
      method: endpoint.method,
      path: endpoint.path,
      body: isBodylessMethod ? undefined : payload,
      query,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Proxy error: ${message}` }, { status: 502 });
  }
}
