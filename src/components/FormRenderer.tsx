"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormField, FormSchema, FormValues, SelectOption } from "@/lib/form-schema";

function getByPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function AsyncSelect({
  sourceEndpointId,
  itemsPath,
  valueKey,
  labelKey,
  value,
  onChange,
  placeholder,
  required,
}: {
  sourceEndpointId: string;
  itemsPath?: string;
  valueKey: string;
  labelKey: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [options, setOptions] = useState<SelectOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dengage/${sourceEndpointId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: null }),
      });
      const raw = await res.json();
      if (!res.ok) {
        setError(raw?.error || `Failed to load (HTTP ${res.status})`);
        setOptions([]);
        return;
      }
      const responseBody = raw.responseBody;
      let items: unknown = responseBody;
      if (itemsPath) items = getByPath(responseBody, itemsPath) ?? responseBody;
      // fall back to a few common shapes
      if (!Array.isArray(items) && responseBody && typeof responseBody === "object") {
        const candidates = ["data", "items", "results", "templates", "list"];
        for (const c of candidates) {
          const v = (responseBody as Record<string, unknown>)[c];
          if (Array.isArray(v)) {
            items = v;
            break;
          }
        }
      }
      if (!Array.isArray(items)) {
        setError("Unexpected response shape - edit itemsPath in the registry.");
        setOptions([]);
        return;
      }
      const opts = items.map((it) => {
        const rec = it as Record<string, unknown>;
        const v = getByPath(rec, valueKey);
        const l = getByPath(rec, labelKey);
        return {
          value: v == null ? "" : String(v),
          label: l == null ? String(v ?? "") : String(l),
        };
      });
      setOptions(opts);
    } catch (e) {
      setError((e as Error).message);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceEndpointId]);

  if (loading && !options) return <div className="muted">Loading options...</div>;

  return (
    <div>
      <select
        value={value ?? ""}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--panel-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "10px 12px",
          width: "100%",
          fontSize: 14,
        }}
      >
        <option value="">{placeholder || "-- select --"}</option>
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} {o.value ? `(${o.value})` : ""}
          </option>
        ))}
      </select>
      <div className="row" style={{ marginTop: 6, gap: 8 }}>
        <button type="button" className="secondary" onClick={load} style={{ padding: "4px 10px", fontSize: 12 }}>
          {loading ? "Refreshing..." : "Refresh list"}
        </button>
        {error ? <span style={{ color: "var(--err)", fontSize: 12 }}>{error}</span> : null}
        {!error && options && options.length === 0 && !loading ? (
          <span className="muted" style={{ fontSize: 12 }}>No items returned.</span>
        ) : null}
      </div>
    </div>
  );
}

function KeyValueEditor({
  value,
  onChange,
  keyLabel = "Key",
  valueLabel = "Value",
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyLabel?: string;
  valueLabel?: string;
}) {
  const rows = useMemo(() => Object.entries(value ?? {}), [value]);

  function update(idx: number, k: string, v: string) {
    const next: Record<string, string> = {};
    rows.forEach(([rk, rv], i) => {
      if (i === idx) next[k] = v;
      else next[rk] = rv;
    });
    onChange(next);
  }

  function add() {
    const next = { ...value };
    let i = 1;
    while (`var${i}` in next) i++;
    next[`var${i}`] = "";
    onChange(next);
  }

  function remove(idx: number) {
    const next: Record<string, string> = {};
    rows.forEach(([rk, rv], i) => {
      if (i !== idx) next[rk] = rv;
    });
    onChange(next);
  }

  return (
    <div>
      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>No variables yet.</div>
      ) : null}
      {rows.map(([k, v], i) => (
        <div key={i} className="row" style={{ marginBottom: 6, gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder={keyLabel}
            value={k}
            onChange={(e) => update(i, e.target.value, v)}
          />
          <input
            style={{ flex: 2 }}
            placeholder={valueLabel}
            value={v}
            onChange={(e) => update(i, k, e.target.value)}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => remove(i)}
            style={{ padding: "6px 10px", fontSize: 12 }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={add}
        style={{ padding: "6px 12px", fontSize: 13 }}
      >
        + Add variable
      </button>
    </div>
  );
}

export default function FormRenderer({
  schema,
  values,
  onChange,
}: {
  schema: FormSchema;
  values: FormValues;
  onChange: (next: FormValues) => void;
}) {
  function update(name: string, v: unknown) {
    onChange({ ...values, [name]: v });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {schema.fields.map((f) => (
        <FieldRow key={f.name} field={f} value={values[f.name]} onChange={(v) => update(f.name, v)} />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={`f-${field.name}`}>
        {field.label}
        {field.required ? <span style={{ color: "var(--err)", marginLeft: 4 }}>*</span> : null}
      </label>
      <FieldControl field={field} value={value} onChange={onChange} />
      {field.help ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{field.help}</div> : null}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "text":
    case "email":
      return (
        <input
          id={`f-${field.name}`}
          type={field.type}
          placeholder={field.placeholder}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <textarea
          id={`f-${field.name}`}
          placeholder={field.placeholder}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight: 90 }}
        />
      );
    case "number":
      return (
        <input
          id={`f-${field.name}`}
          type="number"
          placeholder={field.placeholder}
          required={field.required}
          value={(value as number | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "boolean":
      return (
        <label className="row" style={{ gap: 8 }}>
          <input
            id={`f-${field.name}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="muted" style={{ fontSize: 13 }}>Enabled</span>
        </label>
      );
    case "select":
      return (
        <select
          id={`f-${field.name}`}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            background: "var(--panel-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 12px",
            width: "100%",
            fontSize: 14,
          }}
        >
          <option value="">{field.placeholder || "-- select --"}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "async-select":
      return (
        <AsyncSelect
          sourceEndpointId={field.sourceEndpointId}
          itemsPath={field.itemsPath}
          valueKey={field.valueKey}
          labelKey={field.labelKey}
          value={value as string | undefined}
          onChange={onChange}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case "key-value":
      return (
        <KeyValueEditor
          value={(value as Record<string, string>) || {}}
          onChange={onChange}
          keyLabel={field.keyLabel}
          valueLabel={field.valueLabel}
        />
      );
    case "json":
      return (
        <textarea
          id={`f-${field.name}`}
          className="json-editor"
          spellCheck={false}
          value={typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
      );
  }
}
