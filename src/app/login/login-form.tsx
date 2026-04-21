"use client";

import { useState } from "react";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      method="POST"
      action="/api/auth/login"
      onSubmit={() => setBusy(true)}
    >
      <input type="hidden" name="next" value={nextPath} />
      <label className="label" htmlFor="portal-password">Shared Password</label>
      <input
        id="portal-password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        autoFocus
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <div style={{ height: 16 }} />
      <button type="submit" disabled={busy || !pw} style={{ width: "100%" }}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
