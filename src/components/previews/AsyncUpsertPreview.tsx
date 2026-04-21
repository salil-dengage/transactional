"use client";

import type { FormValues } from "@/lib/form-schema";

type AsyncJobResponse = {
  code?: number;
  message?: string;
  transactionId?: string;
  data?: {
    jobId?: string;
    transactionId?: string;
    uuid?: string;
    successCount?: number;
    processedCount?: number;
    errors?: Array<Record<string, unknown>>;
    warnings?: Array<Record<string, unknown>>;
    [k: string]: unknown;
  };
  errors?: Array<Record<string, unknown>>;
  warnings?: Array<Record<string, unknown>>;
};

function asArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function KV({ label, value, mono }: { label: string; value: string | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: mono ? "var(--mono)" : undefined }}>{value}</div>
    </>
  );
}

function parseCsvPreview(csv: string | undefined) {
  if (!csv || csv.trim().length === 0) return null;
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  const split = (l: string) => l.split(",").map((c) => c.trim());
  return { columns: split(lines[0]), rows: lines.slice(1, 11).map(split), total: lines.length - 1 };
}

function PrelaunchHint({ values }: { values: FormValues }) {
  // CSV-style pre-run preview (UpsertData V2).
  const csvParsed = parseCsvPreview(values.csvContent as string | undefined);
  if (csvParsed && csvParsed.columns.length > 0) {
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--panel-2)",
        }}
      >
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
          <span className="muted">About to upload</span>{" "}
          <strong>{csvParsed.total} row{csvParsed.total === 1 ? "" : "s"}</strong>
          {csvParsed.total > csvParsed.rows.length ? (
            <span className="muted"> (showing first {csvParsed.rows.length})</span>
          ) : null}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {csvParsed.columns.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      fontSize: 11,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvParsed.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Products/orders/etc. - just a friendly hint. Form/Developer view shows the
  // actual records being uploaded above/alongside.
  return (
    <div className="muted" style={{ fontSize: 13 }}>
      Hit <strong style={{ color: "var(--text)" }}>Run</strong> to submit the job. This endpoint
      is asynchronous - Dengage returns a job ID immediately and processes the records in the
      background. You can poll the GetStatus endpoint with the job ID for progress.
    </div>
  );
}

export default function AsyncUpsertPreview({
  values,
  sendResult,
}: {
  values: FormValues;
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  if (!sendResult) return <PrelaunchHint values={values} />;

  if (!sendResult.ok) {
    return (
      <div className="error-banner">
        Request failed (HTTP {sendResult.status}). See Developer view for details.
      </div>
    );
  }

  const body = sendResult.responseBody as AsyncJobResponse;
  const code = body?.code;
  const message = body?.message;
  const ok = code === 0;
  const jobId =
    (body?.data?.jobId as string | undefined) ||
    (body?.data?.transactionId as string | undefined) ||
    (body?.data?.uuid as string | undefined) ||
    body?.transactionId;
  const successCount =
    (typeof body?.data?.successCount === "number" ? body.data.successCount : undefined) ??
    (typeof body?.data?.processedCount === "number" ? body.data.processedCount : undefined);

  const errors = [...asArray(body?.errors), ...asArray(body?.data?.errors)];
  const warnings = [...asArray(body?.warnings), ...asArray(body?.data?.warnings)];

  return (
    <div>
      <div
        className={`status ${ok ? "status-ok" : "status-err"}`}
        style={{ fontSize: 13, marginBottom: 14 }}
      >
        {ok
          ? `Job submitted${successCount !== undefined ? ` (${successCount} processed)` : ""}`
          : `Submission failed${typeof code === "number" ? ` (code ${code})` : ""}${
              typeof message === "string" ? ` - ${message}` : ""
            }`}
      </div>

      {jobId || values.jobName || values.tableId ? (
        <div
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            columnGap: 18,
            rowGap: 6,
            marginBottom: 14,
          }}
        >
          <KV label="Job ID" value={jobId} mono />
          <KV label="Job name" value={values.jobName as string | undefined} />
          <KV label="Target table" value={values.tableId as string | undefined} mono />
          <KV label="Target table name" value={values.tableName as string | undefined} />
        </div>
      ) : null}

      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        Dengage processes async jobs in the background. Use the returned job ID with Dengage&apos;s
        GetStatus endpoint to poll for completion.
      </div>

      {errors.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6, color: "var(--err)" }}>
            Errors ({errors.length})
          </div>
          <pre className="code" style={{ fontSize: 12, maxHeight: 240 }}>
            {JSON.stringify(errors, null, 2)}
          </pre>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div>
          <div className="label" style={{ marginBottom: 6, color: "var(--warn)" }}>
            Warnings ({warnings.length})
          </div>
          <pre className="code" style={{ fontSize: 12, maxHeight: 240 }}>
            {JSON.stringify(warnings, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
