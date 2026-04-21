"use client";

type EventType = "DL" | "OP" | "CL" | "SB" | "HB" | "RJ" | "UB" | string;

type DengageEvent = {
  event_type?: EventType;
  event_date?: string;
  bounce_code?: string | null;
  bounce_text?: string | null;
  link?: string | null;
  os?: string | null;
  browser?: string | null;
  device?: string | null;
  ip?: string | null;
};

type DengageMessage = {
  group_id?: string;
  transaction_id?: string;
  email?: string;
  subject?: string;
  event_type?: EventType;
  event_date?: string;
  created_at?: string;
  from_name?: string;
  from_address?: string;
  events?: DengageEvent[];
};

type DengageReport = {
  code?: number;
  message?: string;
  data?: {
    result?: DengageMessage[];
    queryForNextPage?: boolean;
    affectedRowCount?: number;
    totalRowCount?: number;
  };
};

// Event-type codes per Dengage's transactional schema.
const EVENT_LABEL: Record<string, string> = {
  DL: "Delivered",
  OP: "Opened",
  CL: "Clicked",
  SB: "Soft bounce",
  HB: "Hard bounce",
  RJ: "Rejected",
  UB: "Unsubscribed",
  SP: "Spam",
};

const EVENT_COLOR: Record<string, string> = {
  DL: "var(--ok)",
  OP: "var(--accent)",
  CL: "var(--accent)",
  SB: "var(--warn)",
  HB: "var(--err)",
  RJ: "var(--err)",
  UB: "var(--warn)",
  SP: "var(--err)",
};

function formatTs(s: string | undefined): string {
  if (!s) return "";
  // Dengage timestamps look like 2026-04-20T19:31:39.337 (no Z). Render compactly.
  return s.replace("T", " ").replace(/\..*$/, "");
}

function truncate(s: string | undefined, max = 12): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function Stat({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number | string | undefined;
  color?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 130,
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div className="muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text)" }}>
        {value === undefined ? "-" : value}
      </div>
      {hint ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

function Badge({ type }: { type: EventType | undefined }) {
  const label = EVENT_LABEL[type ?? ""] || (type ?? "-");
  const color = EVENT_COLOR[type ?? ""] || "var(--muted)";
  return (
    <span
      style={{
        display: "inline-block",
        background: "var(--panel-2)",
        color,
        border: `1px solid ${color}`,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 10,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
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
        Pick a date window and hit <strong style={{ color: "var(--text)" }}>Run</strong> to pull
        the transactional email report. Delivery / open / click stats and a per-message table
        will appear here.
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

  const body = sendResult.responseBody as DengageReport;
  const messages = body?.data?.result || [];
  const totalRowCount = body?.data?.totalRowCount;
  const queryForNextPage = body?.data?.queryForNextPage;

  // Each message has a top-level event_type showing its latest event; sum those for
  // the summary strip. Also count every child event to show the bigger picture.
  const msgEventCounts: Record<string, number> = {};
  const allEventCounts: Record<string, number> = {};
  for (const m of messages) {
    const t = m.event_type;
    if (t) msgEventCounts[t] = (msgEventCounts[t] || 0) + 1;
    for (const e of m.events || []) {
      const et = e.event_type;
      if (et) allEventCounts[et] = (allEventCounts[et] || 0) + 1;
    }
  }

  const delivered = msgEventCounts["DL"] || 0;
  const opened = allEventCounts["OP"] || 0;
  const clicked = allEventCounts["CL"] || 0;
  const softBounce = msgEventCounts["SB"] || 0;
  const hardBounce = msgEventCounts["HB"] || 0;
  const total = messages.length;

  const openRate = delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : undefined;
  const clickRate = delivered > 0 ? Math.round((clicked / delivered) * 1000) / 10 : undefined;

  if (total === 0) {
    return (
      <div className="muted">No messages in this time window. Widen the window (Last 7 / 30 days) and try again.</div>
    );
  }

  return (
    <div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Stat label="Messages" value={total} hint={totalRowCount && totalRowCount > total ? `of ${totalRowCount} total` : undefined} />
        <Stat label="Delivered" value={delivered} color="var(--ok)" />
        <Stat label="Opens" value={opened} color="var(--accent)" hint={openRate !== undefined ? `${openRate}% of delivered` : undefined} />
        <Stat label="Clicks" value={clicked} color="var(--accent)" hint={clickRate !== undefined ? `${clickRate}% of delivered` : undefined} />
        <Stat label="Soft bounces" value={softBounce} color="var(--warn)" />
        <Stat label="Hard bounces" value={hardBounce} color="var(--err)" />
      </div>

      {queryForNextPage ? (
        <div
          className="muted"
          style={{
            fontSize: 12,
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 12,
          }}
        >
          More results available — Dengage paginates at {total} rows. Narrow the window for a
          fully-scoped report, or extend the portal later to fetch subsequent pages.
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "max-content 1fr max-content max-content max-content",
            gap: 12,
            padding: "10px 14px",
            background: "var(--panel-2)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: "var(--muted)",
          }}
        >
          <div>Status</div>
          <div>Recipient / Subject</div>
          <div>Events</div>
          <div>Last event</div>
          <div>Transaction ID</div>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {messages.slice(0, 50).map((m, i) => (
            <div
              key={(m.transaction_id || "") + i}
              style={{
                display: "grid",
                gridTemplateColumns: "max-content 1fr max-content max-content max-content",
                gap: 12,
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <Badge type={m.event_type} />
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.email || "-"}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.subject || "-"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {(m.events || []).map((e, j) => (
                  <span
                    key={j}
                    title={
                      e.event_type === "SB" || e.event_type === "HB"
                        ? `${EVENT_LABEL[e.event_type ?? ""] || e.event_type}: ${e.bounce_text || ""}`
                        : EVENT_LABEL[e.event_type ?? ""] || e.event_type
                    }
                    style={{
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: EVENT_COLOR[e.event_type ?? ""] || "var(--muted)",
                      opacity: 0.85,
                      fontSize: 10,
                      lineHeight: "18px",
                      textAlign: "center",
                      color: "#000",
                      fontWeight: 700,
                    }}
                  >
                    {(e.event_type || "?").slice(0, 1)}
                  </span>
                ))}
              </div>
              <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                {formatTs(m.event_date)}
              </div>
              <div
                className="muted"
                style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}
                title={m.transaction_id}
              >
                {truncate(m.transaction_id, 12)}
              </div>
            </div>
          ))}
          {messages.length > 50 ? (
            <div className="muted" style={{ padding: "10px 14px", fontSize: 12 }}>
              Showing first 50 of {messages.length}. Open Developer view for the full payload.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
