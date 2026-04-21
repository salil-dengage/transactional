import Link from "next/link";
import { notFound } from "next/navigation";
import { getEndpoint } from "@/lib/dengage-registry";
import { env } from "@/lib/env";
import DemoClient from "./demo-client";

export const dynamic = "force-dynamic";

export default function EndpointPage({ params }: { params: { endpointId: string } }) {
  const endpoint = getEndpoint(params.endpointId);
  if (!endpoint) notFound();

  const defaultPayload = endpoint.defaultPayload();
  const baseUrl = env.dengageBaseUrl();

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/dashboard" className="muted">&larr; Back to all APIs</Link>
      </div>
      <div className="row" style={{ gap: 12, marginBottom: 4 }}>
        <span className={`method-tag method-${endpoint.method}`}>{endpoint.method}</span>
        <h1 style={{ margin: 0 }}>{endpoint.name}</h1>
      </div>
      <div className="request-line">
        <span>{baseUrl}{endpoint.path}</span>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{endpoint.description}</p>

      {endpoint.docsUrl ? (
        <div style={{ marginBottom: 12 }}>
          <a href={endpoint.docsUrl} target="_blank" rel="noreferrer">Official Dengage docs &#x2197;</a>
        </div>
      ) : null}

      {endpoint.notes && endpoint.notes.length > 0 ? (
        <div className="notes">
          <strong>Before you demo:</strong>
          <ul>
            {endpoint.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      ) : null}

      <DemoClient
        endpointId={endpoint.id}
        method={endpoint.method}
        fullUrl={`${baseUrl}${endpoint.path}`}
        defaultPayload={defaultPayload}
      />
    </div>
  );
}
