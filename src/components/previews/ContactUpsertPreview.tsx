"use client";

import type { FormValues } from "@/lib/form-schema";

type DengageContactResponse = {
  code?: number;
  message?: string;
  transactionId?: string;
  data?: {
    successCount?: number;
    processedCount?: number;
    errors?: Array<Record<string, unknown>>;
    warnings?: Array<Record<string, unknown>>;
    // Defensive: other Dengage response layouts
    [k: string]: unknown;
  };
  errors?: Array<Record<string, unknown>>;
  warnings?: Array<Record<string, unknown>>;
};

function asArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <>
      <div style={{ color: "#6b7280", fontSize: 12 }}>{label}</div>
      <div style={{ color: "#111", fontSize: 13 }}>{value}</div>
    </>
  );
}

function ContactCard({ values }: { values: FormValues }) {
  const name = [values.name, values.surname].filter(Boolean).join(" ") || "(no name)";
  return (
    <div
      style={{
        background: "#fff",
        color: "#111",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid #eef0f3",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#4f46e5,#9333ea)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {(String(values.name || values.contact_key || "?")
            .charAt(0)
            .toUpperCase())}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
          <div style={{ color: "#6b7280", fontSize: 12, fontFamily: "var(--mono)" }}>
            {(values.contact_key as string) || "(no contact_key)"}
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "14px 18px",
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 18,
          rowGap: 8,
        }}
      >
        <Field label="Email" value={values.email as string} />
        <Field label="Phone" value={values.gsm as string} />
        <Field label="Gender" value={values.gender as string} />
        <Field label="Birth date" value={values.birth_date as string} />
        <Field label="Subscription date" value={values.subscription_date as string} />
        <Field
          label="Email opt-in"
          value={
            values.email_permission === true
              ? "Yes"
              : values.email_permission === false
              ? "No"
              : undefined
          }
        />
        <Field
          label="SMS opt-in"
          value={
            values.gsm_permission === true
              ? "Yes"
              : values.gsm_permission === false
              ? "No"
              : undefined
          }
        />
        <Field
          label="Rename to"
          value={values.new_contact_key as string}
        />
      </div>
    </div>
  );
}

export default function ContactUpsertPreview({
  values,
  sendResult,
}: {
  values: FormValues;
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  const body = sendResult?.responseBody as DengageContactResponse | undefined;
  const code = body?.code;
  const message = body?.message;
  const success = sendResult?.ok && code === 0;

  // Dengage returns errors/warnings either at top level or nested under data.
  const errors = [...asArray(body?.errors), ...asArray(body?.data?.errors)];
  const warnings = [...asArray(body?.warnings), ...asArray(body?.data?.warnings)];
  const successCount =
    (typeof body?.data?.successCount === "number" ? body.data.successCount : undefined) ??
    (typeof body?.data?.processedCount === "number" ? body.data.processedCount : undefined);

  return (
    <div>
      {sendResult ? (
        <div
          className={`status ${success ? "status-ok" : "status-err"}`}
          style={{ marginBottom: 14, fontSize: 13 }}
        >
          {success
            ? `Contact upserted${successCount !== undefined ? ` (${successCount} processed)` : ""}`
            : `Upsert failed (HTTP ${sendResult.status}${
                typeof code === "number" ? `, code ${code}` : ""
              })${typeof message === "string" ? ` - ${message}` : " - see Developer view"}`}
        </div>
      ) : null}

      <ContactCard values={values} />

      {errors.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 6, color: "var(--err)" }}>
            Errors ({errors.length})
          </div>
          <pre className="code" style={{ fontSize: 12 }}>
            {JSON.stringify(errors, null, 2)}
          </pre>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 6, color: "var(--warn)" }}>
            Warnings ({warnings.length})
          </div>
          <pre className="code" style={{ fontSize: 12 }}>
            {JSON.stringify(warnings, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
