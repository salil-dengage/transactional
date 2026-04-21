"use client";

import type { FormValues } from "@/lib/form-schema";

function substitute(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

function pick(body: unknown, path: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = body;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export default function EmailPreview({
  values,
  sendResult,
}: {
  values: FormValues;
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  const to = (values.to as string) || "demo@example.com";
  const cc = values.cc as string | undefined;
  const bcc = values.bcc as string | undefined;
  const templateId = (values.templateId as string) || "";
  const params = (values.params as Record<string, string>) || {};
  const subjectOverride = values.subject as string | undefined;
  const preheader = values.preheader as string | undefined;
  const fromNameId = values.fromNameId as string | undefined;
  const replyTo = values.replyTo as string | undefined;
  const htmlBody = values.html as string | undefined;

  const resolvedSubject = subjectOverride
    ? substitute(subjectOverride, params)
    : templateId
    ? `(rendered by Dengage template ${templateId})`
    : "(no subject)";
  const resolvedPreheader = preheader ? substitute(preheader, params) : undefined;
  // If the rep has filled the HTML body (or a scenario did), substitute params
  // client-side so the preview matches what an end user would eventually see.
  const renderedHtml = htmlBody ? substitute(htmlBody, params) : undefined;

  // Dengage returns HTTP 200 with {code:0, message:"Successful", data:{...}} on
  // success. Pull the useful IDs out so the rep can demo tracking.
  const dengageCode = sendResult && typeof sendResult.responseBody === "object" && sendResult.responseBody
    ? (sendResult.responseBody as Record<string, unknown>).code
    : undefined;
  const dengageMessage = sendResult && typeof sendResult.responseBody === "object" && sendResult.responseBody
    ? (sendResult.responseBody as Record<string, unknown>).message
    : undefined;
  const trackingId = pick(sendResult?.responseBody, "data.to.trackingId");
  const groupId = pick(sendResult?.responseBody, "data.groupId");
  const transactionId = pick(sendResult?.responseBody, "transactionId");
  const dengageOk = sendResult?.ok && dengageCode === 0;

  return (
    <div>
      {sendResult ? (
        <div style={{ marginBottom: 14 }}>
          <div
            className={`status ${dengageOk ? "status-ok" : "status-err"}`}
            style={{ fontSize: 13, marginBottom: dengageOk ? 10 : 0 }}
          >
            {dengageOk
              ? `Email dispatched to ${to}`
              : `Send failed (HTTP ${sendResult.status}${typeof dengageCode === "number" ? `, code ${dengageCode}` : ""})${typeof dengageMessage === "string" ? ` - ${dengageMessage}` : " - see Developer view"}`}
          </div>
          {dengageOk && (trackingId || groupId || transactionId) ? (
            <div
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                display: "grid",
                gridTemplateColumns: "max-content 1fr",
                columnGap: 14,
                rowGap: 4,
              }}
            >
              {trackingId ? (
                <>
                  <div className="muted">Tracking ID</div>
                  <div style={{ fontFamily: "var(--mono)" }}>{trackingId}</div>
                </>
              ) : null}
              {groupId ? (
                <>
                  <div className="muted">Group ID</div>
                  <div style={{ fontFamily: "var(--mono)" }}>{groupId}</div>
                </>
              ) : null}
              {transactionId ? (
                <>
                  <div className="muted">Transaction ID</div>
                  <div style={{ fontFamily: "var(--mono)" }}>{transactionId}</div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "#fff",
          color: "#111",
          fontSize: 13,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{resolvedSubject}</div>
          {resolvedPreheader ? (
            <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>{resolvedPreheader}</div>
          ) : null}
          <div style={{ color: "#666", fontSize: 12 }}>
            From: {fromNameId ? <>sender ID <code style={{ fontFamily: "var(--mono)" }}>{fromNameId}</code></> : <em>template default</em>}
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>To: {to}</div>
          {cc ? <div style={{ color: "#666", fontSize: 12 }}>Cc: {cc}</div> : null}
          {bcc ? <div style={{ color: "#666", fontSize: 12 }}>Bcc: {bcc}</div> : null}
          {replyTo ? <div style={{ color: "#666", fontSize: 12 }}>Reply-To: {replyTo}</div> : null}
          {templateId ? (
            <div style={{ color: "#666", fontSize: 12, fontFamily: "var(--mono)", marginTop: 4 }}>
              Template ID: {templateId}
            </div>
          ) : null}
        </div>
        {renderedHtml ? (
          <iframe
            title="email body preview"
            srcDoc={renderedHtml}
            sandbox=""
            style={{ width: "100%", height: 520, border: "none", background: "#fff" }}
          />
        ) : (
          <div style={{ padding: 22, color: "#333", minHeight: 180 }}>
            <div style={{ marginBottom: 10, fontWeight: 600 }}>
              Hi {params.firstName || "{{firstName}}"},
            </div>
            <div style={{ color: "#555", lineHeight: 1.6 }}>
              The body of this email is rendered by Dengage using template{" "}
              <strong style={{ fontFamily: "var(--mono)" }}>{templateId || "<not set>"}</strong>,
              so its real look will reflect whatever HTML and copy you configured for that
              template in the Dengage platform. The variables you fill in below are passed in as
              merge tags.
            </div>
            {Object.keys(params).length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    color: "#888",
                    marginBottom: 6,
                  }}
                >
                  Variables sent
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "max-content 1fr",
                    columnGap: 14,
                    rowGap: 4,
                    fontSize: 13,
                  }}
                >
                  {Object.entries(params).map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <div style={{ fontFamily: "var(--mono)", color: "#555" }}>{k}</div>
                      <div>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
