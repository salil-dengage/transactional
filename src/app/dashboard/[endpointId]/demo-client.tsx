"use client";

import { useMemo, useState } from "react";

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

export default function DemoClient({
  endpointId,
  method,
  fullUrl,
  defaultPayload,
}: {
  endpointId: string;
  method: string;
  fullUrl: string;
  defaultPayload: unknown;
}) {
  const [raw, setRaw] = useState<string>(() => JSON.stringify(defaultPayload, null, 2));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const parseError = useMemo(() => {
    try {
      JSON.parse(raw);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [raw]);

  async function send() {
    setLocalError(null);
    setResult(null);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      setLocalError("Payload is not valid JSON: " + (e as Error).message);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/dengage/${endpointId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: body }),
      });
      const data = (await res.json()) as ProxyResult | { error: string };
      if ("error" in data) {
        setLocalError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRaw(JSON.stringify(defaultPayload, null, 2));
    setResult(null);
    setLocalError(null);
  }

  function curl() {
    let body: string;
    try {
      body = JSON.stringify(JSON.parse(raw));
    } catch {
      body = raw;
    }
    return [
      `curl --request ${method} \\`,
      `  --url ${fullUrl} \\`,
      `  --header 'accept: application/json' \\`,
      `  --header 'authorization: Bearer YOUR_TOKEN' \\`,
      `  --header 'content-type: application/json' \\`,
      `  --data '${body.replace(/'/g, "'\\''")}'`,
    ].join("\n");
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

  return (
    <div className="demo-grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label" style={{ margin: 0 }}>Request body</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="secondary" onClick={reset}>Reset</button>
            <button type="button" className="secondary" onClick={() => copy("curl", curl())}>
              {copied === "curl" ? "Copied!" : "Copy as curl"}
            </button>
          </div>
        </div>
        <textarea
          className="json-editor"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        {parseError ? (
          <div className="error-banner" style={{ marginTop: 10 }}>Invalid JSON: {parseError}</div>
        ) : null}
        <div style={{ marginTop: 12 }} className="row">
          <button onClick={send} disabled={busy || !!parseError}>
            {busy ? "Sending..." : `Send ${method} request`}
          </button>
          <span className="muted">
            Request is proxied through the portal. Your token is attached server-side.
          </span>
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
              <button
                type="button"
                className="secondary"
                onClick={() => copy("body", JSON.stringify(result.responseBody, null, 2))}
              >
                {copied === "body" ? "Copied!" : "Copy body"}
              </button>
            </div>
          ) : null}
        </div>

        {localError ? (
          <div className="error-banner">{localError}</div>
        ) : null}

        {!result && !localError && (
          <div className="muted">No request sent yet. Hit &quot;Send&quot; to see the live Dengage response here.</div>
        )}

        {result ? (
          <>
            <div className="code">{JSON.stringify(result.responseBody, null, 2)}</div>
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>Response headers</summary>
              <div className="code" style={{ marginTop: 8 }}>
                {Object.entries(result.responseHeaders)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}
