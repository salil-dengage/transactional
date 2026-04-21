"use client";

type TemplateRecord = {
  id?: unknown;
  name?: unknown;
  subject?: unknown;
  [k: string]: unknown;
};

function extractList(responseBody: unknown): TemplateRecord[] {
  if (Array.isArray(responseBody)) return responseBody as TemplateRecord[];
  if (responseBody && typeof responseBody === "object") {
    for (const key of ["data", "items", "results", "templates", "list"]) {
      const v = (responseBody as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as TemplateRecord[];
    }
  }
  return [];
}

export default function TemplateListPreview({
  sendResult,
}: {
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  if (!sendResult) {
    return (
      <div className="muted" style={{ fontSize: 14 }}>
        Hit <strong style={{ color: "var(--text)" }}>Run</strong> to fetch your templates from Dengage.
        They&apos;ll be listed here as cards with their IDs and names.
      </div>
    );
  }
  if (!sendResult.ok) {
    return (
      <div className="error-banner">
        Request failed (HTTP {sendResult.status}). See Developer view for details.
      </div>
    );
  }

  const list = extractList(sendResult.responseBody);
  if (list.length === 0) {
    return <div className="muted">No templates were returned.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="muted" style={{ fontSize: 13 }}>{list.length} templates found.</div>
      {list.map((t, i) => {
        const id = String(t.id ?? i);
        const name = (t.name as string) || id;
        const subject = t.subject as string | undefined;
        return (
          <div
            key={id + i}
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{name}</div>
            <div className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
              id: {id}
            </div>
            {subject ? (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <span className="muted">Subject: </span>{subject}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
