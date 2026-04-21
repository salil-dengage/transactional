"use client";

// Dengage admin-UI 'getTransactionalEmailList' response shape.
// Older shape (data.result[]) is kept as a defensive fallback below.
type SendRow = {
  transactionId?: string;
  subject?: string;
  email?: string;
  sendDate?: string;
  lastActionDate?: string;
  lastActionType?: string;
  errorMessage?: string;
  rcptType?: string;
  contentName?: string;
  isReachable?: boolean;
  tagIds?: unknown[];
  // Legacy shape fields (kept so an old-style response doesn't crash the UI)
  event_type?: string;
  event_date?: string;
  events?: Array<{ event_type?: string }>;
  created_at?: string;
};

type ReportBody = {
  code?: number;
  totalCount?: number;
  resultList?: SendRow[];
  // Legacy wrapper (old endpoint)
  data?: { result?: SendRow[]; totalRowCount?: number; queryForNextPage?: boolean };
};

// Dengage action-code dictionary. Same codes appear as lastActionType here
// and as event_type in the older endpoint's response.
const ACTION_LABEL: Record<string, string> = {
  DL: "Delivered",
  OP: "Opened",
  CL: "Clicked",
  SB: "Soft bounce",
  HB: "Hard bounce",
  RJ: "Rejected",
  UB: "Unsubscribed",
  SP: "Spam",
};
const ACTION_COLOR: Record<string, string> = {
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
      <div
        className="muted"
        style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text)" }}>
        {value === undefined ? "-" : value}
      </div>
      {hint ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

function Badge({ type }: { type: string | undefined }) {
  const label = ACTION_LABEL[type ?? ""] || (type ?? "-");
  const color = ACTION_COLOR[type ?? ""] || "var(--muted)";
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
        Pick a time window (and optionally a recipient email) and hit{" "}
        <strong style={{ color: "var(--text)" }}>Run</strong>. Delivery / open / click stats
        and a per-message table will appear here.
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

  const body = sendResult.responseBody as ReportBody;

  // The admin-UI endpoint returns { totalCount, resultList }. The older
  // endpoint returned { data: { result, totalRowCount } }. Accept either.
  const rows: SendRow[] = body?.resultList || body?.data?.result || [];
  const totalCount = body?.totalCount ?? body?.data?.totalRowCount ?? rows.length;

  if (rows.length === 0) {
    return (
      <div className="muted">
        No sends matched the filter. Widen the window, clear the recipient filter, or check
        that the date range is in UTC.
      </div>
    );
  }

  // Group by lastActionType (new shape) / event_type (legacy shape).
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const t = r.lastActionType || r.event_type;
    if (t) counts[t] = (counts[t] || 0) + 1;
  }

  const delivered = counts["DL"] || 0;
  const opened = counts["OP"] || 0;
  const clicked = counts["CL"] || 0;
  const softBounce = counts["SB"] || 0;
  const hardBounce = counts["HB"] || 0;

  const successCount = delivered + opened + clicked; // anything past 'delivered' is also delivered
  const openRate = successCount > 0 ? Math.round((opened / successCount) * 1000) / 10 : undefined;
  const clickRate = successCount > 0 ? Math.round((clicked / successCount) * 1000) / 10 : undefined;

  return (
    <div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Stat
          label="Messages"
          value={rows.length}
          hint={totalCount > rows.length ? `of ${totalCount} total` : undefined}
        />
        <Stat label="Delivered" value={delivered} color="var(--ok)" />
        <Stat label="Opens" value={opened} color="var(--accent)" hint={openRate !== undefined ? `${openRate}% of delivered+` : undefined} />
        <Stat label="Clicks" value={clicked} color="var(--accent)" hint={clickRate !== undefined ? `${clickRate}% of delivered+` : undefined} />
        <Stat label="Soft bounces" value={softBounce} color="var(--warn)" />
        <Stat label="Hard bounces" value={hardBounce} color="var(--err)" />
      </div>

      {totalCount > rows.length ? (
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
          Showing {rows.length} of {totalCount}. Increase limit or raise offset to fetch more.
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
          <div>Content</div>
          <div>Last action</div>
          <div>Transaction ID</div>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {rows.slice(0, 100).map((r, i) => {
            const action = r.lastActionType || r.event_type;
            const lastTs = r.lastActionDate || r.event_date || r.sendDate;
            return (
              <div
                key={(r.transactionId || "") + i}
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
                <Badge type={action} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={r.email}
                  >
                    {r.email || "-"}
                  </div>
                  <div
                    className="muted"
                    style={{
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={r.subject}
                  >
                    {r.subject || "-"}
                  </div>
                  {r.errorMessage ? (
                    <div style={{ color: "var(--err)", fontSize: 12, marginTop: 2 }} title={r.errorMessage}>
                      {truncate(r.errorMessage, 80)}
                    </div>
                  ) : null}
                </div>
                <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }} title={r.contentName}>
                  {truncate(r.contentName, 18) || "-"}
                </div>
                <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {formatTs(lastTs)}
                </div>
                <div
                  className="muted"
                  style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}
                  title={r.transactionId}
                >
                  {truncate(r.transactionId, 12)}
                </div>
              </div>
            );
          })}
          {rows.length > 100 ? (
            <div className="muted" style={{ padding: "10px 14px", fontSize: 12 }}>
              Showing first 100 of {rows.length}. Open Developer view for the full payload.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
