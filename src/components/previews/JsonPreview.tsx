"use client";

export default function JsonPreview({
  sendResult,
}: {
  sendResult?: { ok: boolean; status: number; responseBody: unknown } | null;
}) {
  if (!sendResult) {
    return (
      <div className="muted" style={{ fontSize: 14 }}>
        Run the request to see the response payload here.
      </div>
    );
  }
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className={`status ${sendResult.ok ? "status-ok" : "status-err"}`}>
          HTTP {sendResult.status}
        </span>
      </div>
      <pre className="code" style={{ maxHeight: 500 }}>
        {JSON.stringify(sendResult.responseBody, null, 2)}
      </pre>
    </div>
  );
}
