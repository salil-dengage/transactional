"use client";

import { useState } from "react";

export default function HealthCheck() {
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "ok"; msg: string } | { status: "err"; msg: string }
  >({ status: "idle" });

  async function run() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/dengage-health", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) setState({ status: "ok", msg: data.message });
      else setState({ status: "err", msg: data.message || `HTTP ${res.status}` });
    } catch (e) {
      setState({ status: "err", msg: (e as Error).message });
    }
  }

  return (
    <div className="panel" style={{ margin: "16px 0", padding: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Connection check</div>
          <div className="muted">
            Verify this server can authenticate to Dengage. Useful right after IP-whitelisting this host.
          </div>
        </div>
        <div className="row">
          <button className="secondary" onClick={run} disabled={state.status === "loading"}>
            {state.status === "loading" ? "Checking..." : "Test login to Dengage"}
          </button>
          {state.status === "ok" && <span className="status status-ok">OK</span>}
          {state.status === "err" && <span className="status status-err">FAIL</span>}
        </div>
      </div>
      {(state.status === "ok" || state.status === "err") && (
        <div className="code" style={{ marginTop: 12 }}>{state.msg}</div>
      )}
    </div>
  );
}
