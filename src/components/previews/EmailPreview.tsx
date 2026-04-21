"use client";

import { useEffect, useState } from "react";
import type { FormValues } from "@/lib/form-schema";

type TemplateRecord = {
  id: string;
  name?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  from?: string;
  fromName?: string;
  [k: string]: unknown;
};

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

function pickFirst(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
}

function extractTemplateList(responseBody: unknown): TemplateRecord[] {
  if (Array.isArray(responseBody)) return responseBody as TemplateRecord[];
  if (responseBody && typeof responseBody === "object") {
    for (const key of ["data", "items", "results", "templates", "list"]) {
      const v = (responseBody as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as TemplateRecord[];
    }
  }
  return [];
}

function substitute(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

export default function EmailPreview({
  values,
  sendResult,
}: {
  values: FormValues;
  /** Filled in after the rep hits Send. */
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  const [templates, setTemplates] = useState<TemplateRecord[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const to = (values.to as string) || "demo@example.com";
  const templateId = (values.templateId as string) || "";
  const params = (values.params as Record<string, string>) || {};
  const subjectOverride = values.subject as string | undefined;
  const fromNameOverride = values.fromName as string | undefined;
  const fromEmailOverride = values.fromEmail as string | undefined;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/dengage/list-transactional-templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ payload: null }),
        });
        const raw = await res.json();
        if (!res.ok) {
          if (!cancelled) setTemplatesError(raw?.error || `HTTP ${res.status}`);
          return;
        }
        const list = extractTemplateList(raw.responseBody);
        if (!cancelled) setTemplates(list);
      } catch (e) {
        if (!cancelled) setTemplatesError((e as Error).message);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const template = templates?.find((t) => String(t.id) === String(templateId)) || null;

  const resolvedSubject = subjectOverride
    ? substitute(subjectOverride, params)
    : template?.subject
    ? substitute(template.subject, params)
    : "(no subject)";
  const resolvedFromName = fromNameOverride || (template?.fromName as string | undefined) || "Sender";
  const resolvedFromEmail = fromEmailOverride || (template?.from as string | undefined) || "no-reply@example.com";

  const htmlBody = (template ? pickFirst(template as Record<string, unknown>, ["htmlBody", "html", "bodyHtml", "content"]) : undefined) as
    | string
    | undefined;
  const textBody = (template ? pickFirst(template as Record<string, unknown>, ["textBody", "text", "plainText", "bodyText"]) : undefined) as
    | string
    | undefined;

  const renderedHtml = htmlBody ? substitute(htmlBody, params) : undefined;
  const renderedText = textBody ? substitute(textBody, params) : undefined;

  return (
    <div>
      {sendResult ? (
        <div
          className={`status ${sendResult.ok ? "status-ok" : "status-err"}`}
          style={{ marginBottom: 14, fontSize: 13 }}
        >
          {sendResult.ok ? "Email dispatched" : `Send failed (HTTP ${sendResult.status})`}
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
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{resolvedSubject}</div>
          <div style={{ color: "#666", fontSize: 12 }}>
            From: <strong>{resolvedFromName}</strong> &lt;{resolvedFromEmail}&gt;
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>To: {to}</div>
        </div>
        <div style={{ padding: 0, background: "#fff" }}>
          {renderedHtml ? (
            <iframe
              title="email body"
              srcDoc={renderedHtml}
              style={{ width: "100%", minHeight: 380, border: "none", background: "#fff" }}
              sandbox=""
            />
          ) : renderedText ? (
            <pre style={{ margin: 0, padding: 18, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{renderedText}</pre>
          ) : (
            <div style={{ padding: 18, color: "#666" }}>
              {templatesError ? (
                <>
                  <div style={{ color: "#b00", marginBottom: 8 }}>Could not load templates: {templatesError}</div>
                  <div>Pick a template once the list API works to see a live preview here.</div>
                </>
              ) : !templates ? (
                "Loading templates..."
              ) : !templateId ? (
                "Pick a template above to see what this email will look like."
              ) : !template ? (
                `Template ${templateId} not found in the fetched list.`
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    Template <strong>{(template.name as string) || template.id}</strong> selected,
                    but the list API did not return an HTML body for preview.
                  </div>
                  <div style={{ fontSize: 12 }}>
                    Fields found on this template:
                    <pre
                      style={{
                        margin: "6px 0 0 0",
                        background: "#f4f4f4",
                        padding: 10,
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        color: "#333",
                      }}
                    >
                      {JSON.stringify(template, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {Object.keys(params).length > 0 ? (
        <div style={{ marginTop: 12 }} className="muted">
          <strong style={{ color: "var(--text)" }}>Variables substituted:</strong>{" "}
          {Object.entries(params).map(([k, v]) => (
            <span key={k} style={{ fontFamily: "var(--mono)", fontSize: 12, marginRight: 10 }}>
              {k}={v}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
