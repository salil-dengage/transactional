import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryMeta, getEndpoint } from "@/lib/dengage-registry";
import { env } from "@/lib/env";
import DemoClient from "./demo-client";

export const dynamic = "force-dynamic";

export default function EndpointPage({ params }: { params: { endpointId: string } }) {
  const endpoint = getEndpoint(params.endpointId);
  if (!endpoint) notFound();

  const defaultPayload = endpoint.defaultPayload ? endpoint.defaultPayload() : {};
  const baseUrl = (endpoint.baseUrl || env.dengageBaseUrl()).replace(/\/$/, "");

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/dashboard" className="muted">&larr; Back to all APIs</Link>
      </div>
      <div className="row" style={{ gap: 12, marginBottom: 4 }}>
        <span className={`method-tag method-${endpoint.method}`}>{endpoint.method}</span>
        <h1 style={{ margin: 0 }}>{endpoint.name}</h1>
        <span className="muted" style={{ fontSize: 13 }}>{categoryMeta[endpoint.category].label}</span>
      </div>
      <div className="request-line">
        <span>{baseUrl}{endpoint.path}</span>
      </div>
      <p className="muted" style={{ marginTop: 0, maxWidth: 760 }}>{endpoint.description}</p>

      {endpoint.docsUrl ? (
        <div style={{ marginBottom: 12 }}>
          <a href={endpoint.docsUrl} target="_blank" rel="noreferrer">Official Dengage docs &#x2197;</a>
        </div>
      ) : null}

      <DemoClient
        endpoint={{
          id: endpoint.id,
          name: endpoint.name,
          method: endpoint.method,
          fullUrl: `${baseUrl}${endpoint.path}`,
          form: endpoint.form,
          scenarios: endpoint.scenarios,
          previewKind: endpoint.previewKind,
          notes: endpoint.notes,
          defaultPayload,
        }}
      />
    </div>
  );
}
