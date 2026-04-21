"use client";

type ReportLike = Record<string, unknown>;

function findFirstNumeric(obj: unknown, keys: string[]): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as ReportLike;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  }
  // Walk one level deeper
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      const found = findFirstNumeric(v, keys);
      if (typeof found === "number") return found;
    }
  }
  return undefined;
}

function Stat({ label, value, color }: { label: string; value: number | string | undefined; color?: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div className="muted" style={{ fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text)" }}>
        {value === undefined ? "-" : value}
      </div>
    </div>
  );
}

export default function DeliveryReportPreview({
  sendResult,
}: {
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  if (!sendResult) {
    return (
      <div className="muted" style={{ fontSize: 14 }}>
        Pick a date window and hit <strong style={{ color: "var(--text)" }}>Run</strong> to pull the
        transactional email report. A visual summary will appear here.
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

  const body = sendResult.responseBody;
  const sent = findFirstNumeric(body, ["sent", "sentCount", "total", "totalSent"]);
  const delivered = findFirstNumeric(body, ["delivered", "deliveredCount"]);
  const opens = findFirstNumeric(body, ["opens", "openCount", "opened", "uniqueOpens"]);
  const clicks = findFirstNumeric(body, ["clicks", "clickCount", "clicked", "uniqueClicks"]);
  const bounces = findFirstNumeric(body, ["bounces", "bounceCount", "bounced"]);
  const unsubs = findFirstNumeric(body, ["unsubscribes", "unsubCount", "unsubscribed"]);

  const anyStat = [sent, delivered, opens, clicks, bounces, unsubs].some((v) => typeof v === "number");

  if (!anyStat) {
    return (
      <div>
        <div className="notes" style={{ marginBottom: 12 }}>
          Report returned successfully, but the portal couldn&apos;t recognize standard stat field names.
          Showing raw response below - open Developer view for the full structure.
        </div>
        <pre className="code" style={{ maxHeight: 400 }}>
          {JSON.stringify(body, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Stat label="Sent" value={sent} />
        <Stat label="Delivered" value={delivered} color="var(--ok)" />
        <Stat label="Opens" value={opens} color="var(--accent)" />
        <Stat label="Clicks" value={clicks} color="var(--accent)" />
        <Stat label="Bounces" value={bounces} color="var(--err)" />
        <Stat label="Unsubscribes" value={unsubs} color="var(--warn)" />
      </div>
      <details style={{ marginTop: 16 }}>
        <summary className="muted" style={{ cursor: "pointer" }}>Raw report payload</summary>
        <pre className="code" style={{ marginTop: 8, maxHeight: 400 }}>
          {JSON.stringify(body, null, 2)}
        </pre>
      </details>
    </div>
  );
}
