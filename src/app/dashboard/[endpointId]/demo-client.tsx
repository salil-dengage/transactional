"use client";

import { useMemo, useState } from "react";
import FormRenderer from "@/components/FormRenderer";
import Preview, { type SendResult } from "@/components/previews";
import type { FormSchema, FormValues } from "@/lib/form-schema";
import { buildPayload, seedValues } from "@/lib/form-schema";
import type { PreviewKind, Scenario } from "@/lib/dengage-registry";

type EndpointProps = {
  id: string;
  name: string;
  method: string;
  fullUrl: string;
  form?: FormSchema;
  scenarios?: Scenario[];
  previewKind?: PreviewKind;
  notes?: string[];
  defaultPayload: unknown;
};

type ProxyResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  requestUrl: string;
  requestMethod: string;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, string>;
};

type Tab = "functional" | "developer";

export default function DemoClient({ endpoint }: { endpoint: EndpointProps }) {
  const hasFunctional = Boolean(endpoint.form);
  const [tab, setTab] = useState<Tab>(hasFunctional ? "functional" : "developer");

  const initialValues = useMemo<FormValues>(() => {
    if (endpoint.form) return seedValues(endpoint.form);
    return {};
  }, [endpoint.form]);

  const [values, setValues] = useState<FormValues>(initialValues);
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(endpoint.defaultPayload, null, 2));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Keep the Developer JSON in sync with form changes so switching tabs "just works".
  function updateValues(next: FormValues) {
    setValues(next);
    if (endpoint.form) {
      const built = buildPayload(endpoint.form, next);
      setRawJson(JSON.stringify(built, null, 2));
    }
  }

  function applyScenario(s: Scenario) {
    if (!endpoint.form) return;
    // Preserve whatever the rep has already typed (especially templateId that
    // the scenario doesn't set) - scenarios override ONLY the keys they
    // specify. This keeps multi-scenario exploration frictionless.
    const merged = { ...values, ...s.values };
    updateValues(merged);
  }

  async function send(bodyOverride?: unknown) {
    setLocalError(null);
    setResult(null);
    let body: unknown;
    if (bodyOverride !== undefined) {
      body = bodyOverride;
    } else if (tab === "developer") {
      try {
        body = JSON.parse(rawJson);
      } catch (e) {
        setLocalError("Payload is not valid JSON: " + (e as Error).message);
        return;
      }
    } else if (endpoint.form) {
      body = buildPayload(endpoint.form, values);
    } else {
      body = endpoint.defaultPayload;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/dengage/${endpoint.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: body }),
      });
      const data = (await res.json()) as ProxyResult | { error: string };
      if ("error" in data) setLocalError(data.error);
      else setResult(data);
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      },
      () => setCopied(null),
    );
  }

  function curl() {
    // Prefer the ACTUAL body that was sent to Dengage (post-transform) when a
    // run has happened, so 'Copy as curl' works outside the portal too. Falls
    // back to the raw editor content before the first run.
    let body: string;
    if (result && result.requestBody !== undefined && result.requestBody !== null) {
      body = JSON.stringify(result.requestBody);
    } else {
      try {
        body = JSON.stringify(JSON.parse(rawJson));
      } catch {
        body = rawJson;
      }
    }
    // Prefer the URL that was actually sent (with query string) once we have one.
    const url = result?.requestUrl || endpoint.fullUrl;
    const lines = [
      `curl --request ${endpoint.method} \\`,
      `  --url '${url}' \\`,
      `  --header 'accept: application/json' \\`,
      `  --header 'authorization: YOUR_ACCESS_TOKEN' \\`,
    ];
    if (endpoint.method !== "GET" && endpoint.method !== "DELETE") {
      lines.push(`  --header 'content-type: application/json' \\`);
      lines.push(`  --data '${body.replace(/'/g, "'\\''")}'`);
    } else {
      // drop trailing backslash on the last line
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, "");
    }
    return lines.join("\n");
  }

  const sendResultForPreview: SendResult = result
    ? { ok: result.ok, status: result.status, responseBody: result.responseBody }
    : null;

  return (
    <div>
      {endpoint.notes && endpoint.notes.length > 0 ? (
        <div className="notes" style={{ marginBottom: 16 }}>
          <strong>Before you demo:</strong>
          <ul>{endpoint.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      ) : null}

      <div className="tabs">
        {hasFunctional ? (
          <button
            type="button"
            className={tab === "functional" ? "tab active" : "tab"}
            onClick={() => setTab("functional")}
          >
            Functional
          </button>
        ) : null}
        <button
          type="button"
          className={tab === "developer" ? "tab active" : "tab"}
          onClick={() => setTab("developer")}
        >
          Developer
        </button>
      </div>

      {tab === "functional" && hasFunctional ? (
        <FunctionalView
          endpoint={endpoint}
          values={values}
          onValuesChange={updateValues}
          onRunScenario={applyScenario}
          onSend={() => send()}
          busy={busy}
          error={localError}
          result={result}
          sendResultForPreview={sendResultForPreview}
        />
      ) : (
        <DeveloperView
          rawJson={rawJson}
          setRawJson={setRawJson}
          method={endpoint.method}
          fullUrl={endpoint.fullUrl}
          onSend={() => send()}
          onReset={() => setRawJson(JSON.stringify(endpoint.defaultPayload, null, 2))}
          onCopyCurl={() => copy("curl", curl())}
          copied={copied}
          busy={busy}
          error={localError}
          result={result}
          onCopyBody={() =>
            result && copy("body", JSON.stringify(result.responseBody, null, 2))
          }
        />
      )}
    </div>
  );
}

function FunctionalView({
  endpoint,
  values,
  onValuesChange,
  onRunScenario,
  onSend,
  busy,
  error,
  result,
  sendResultForPreview,
}: {
  endpoint: EndpointProps;
  values: FormValues;
  onValuesChange: (v: FormValues) => void;
  onRunScenario: (s: Scenario) => void;
  onSend: () => void;
  busy: boolean;
  error: string | null;
  result: ProxyResult | null;
  sendResultForPreview: SendResult;
}) {
  const form = endpoint.form!;
  return (
    <div>
      {endpoint.scenarios && endpoint.scenarios.length > 0 ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 10 }}>Demo scenarios</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {endpoint.scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                className="secondary"
                onClick={() => onRunScenario(s)}
                title={s.description || ""}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="demo-grid">
        <div className="panel">
          <div className="label" style={{ marginBottom: 14 }}>Inputs</div>
          <FormRenderer schema={form} values={values} onChange={onValuesChange} />
          {error ? <div className="error-banner" style={{ marginTop: 14 }}>{error}</div> : null}
          <div className="row" style={{ marginTop: 16 }}>
            <button onClick={onSend} disabled={busy}>
              {busy ? "Running..." : actionLabel(endpoint.method)}
            </button>
            {result ? (
              <span className={`status ${result.ok ? "status-ok" : "status-err"}`}>
                HTTP {result.status}
              </span>
            ) : null}
            {result ? <span className="muted">{result.durationMs} ms</span> : null}
          </div>
        </div>

        <div className="panel">
          <div className="label" style={{ marginBottom: 14 }}>Outcome</div>
          <Preview kind={endpoint.previewKind} values={values} sendResult={sendResultForPreview} />
        </div>
      </div>
    </div>
  );
}

function DeveloperView({
  rawJson,
  setRawJson,
  method,
  fullUrl,
  onSend,
  onReset,
  onCopyCurl,
  onCopyBody,
  copied,
  busy,
  error,
  result,
}: {
  rawJson: string;
  setRawJson: (s: string) => void;
  method: string;
  fullUrl: string;
  onSend: () => void;
  onReset: () => void;
  onCopyCurl: () => void;
  onCopyBody: () => void;
  copied: string | null;
  busy: boolean;
  error: string | null;
  result: ProxyResult | null;
}) {
  const parseError = useMemo(() => {
    try {
      JSON.parse(rawJson);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [rawJson]);

  const bodyless = method === "GET" || method === "DELETE";

  return (
    <div className="demo-grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label" style={{ margin: 0 }}>
            {bodyless ? "Request (no body)" : "Request body"}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="secondary" onClick={onReset}>Reset</button>
            <button type="button" className="secondary" onClick={onCopyCurl}>
              {copied === "curl" ? "Copied!" : "Copy as curl"}
            </button>
          </div>
        </div>
        <div className="request-line" style={{ marginBottom: 10 }}>
          <span className={`method-tag method-${method}`}>{method}</span>
          <span>{result?.requestUrl || fullUrl}</span>
        </div>
        {result?.requestUrl && result.requestUrl !== fullUrl ? (
          <div className="muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 10 }}>
            Full URL that was just sent to Dengage (including query-string parameters).
          </div>
        ) : null}
        {!bodyless ? (
          <>
            <textarea
              className="json-editor"
              spellCheck={false}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
            />
            {parseError ? (
              <div className="error-banner" style={{ marginTop: 10 }}>Invalid JSON: {parseError}</div>
            ) : null}
          </>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>
            This is a {method} request - no body is sent.
          </div>
        )}
        {error ? <div className="error-banner" style={{ marginTop: 10 }}>{error}</div> : null}
        <div style={{ marginTop: 12 }} className="row">
          <button onClick={onSend} disabled={busy || (!bodyless && !!parseError)}>
            {busy ? "Sending..." : `Send ${method} request`}
          </button>
          <span className="muted">Proxied through the portal; token attached server-side.</span>
        </div>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label" style={{ margin: 0 }}>Response</span>
          {result ? (
            <div className="row" style={{ gap: 10 }}>
              <span className={`status ${result.ok ? "status-ok" : "status-err"}`}>
                HTTP {result.status}
              </span>
              <span className="muted">{result.durationMs} ms</span>
              <button type="button" className="secondary" onClick={onCopyBody}>
                {copied === "body" ? "Copied!" : "Copy body"}
              </button>
            </div>
          ) : null}
        </div>
        {!result && !error ? (
          <div className="muted">No request sent yet.</div>
        ) : null}
        {result ? (
          <>
            <div className="code">{JSON.stringify(result.responseBody, null, 2)}</div>
            {result.requestBody !== null && result.requestBody !== undefined ? (
              <details style={{ marginTop: 12 }}>
                <summary className="muted" style={{ cursor: "pointer" }}>
                  Request body actually sent to Dengage
                </summary>
                <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>
                  Shown post-transform (e.g. a flat form is wrapped into the API&apos;s
                  nested body). &quot;Copy as curl&quot; emits exactly this payload.
                </div>
                <div className="code" style={{ marginTop: 4 }}>
                  {JSON.stringify(result.requestBody, null, 2)}
                </div>
              </details>
            ) : null}
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>Response headers</summary>
              <div className="code" style={{ marginTop: 8 }}>
                {Object.entries(result.responseHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}

function actionLabel(method: string): string {
  if (method === "GET") return "Run";
  if (method === "DELETE") return "Delete";
  if (method === "PUT") return "Update";
  return "Send";
}
