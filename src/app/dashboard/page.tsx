import Link from "next/link";
import { endpoints } from "@/lib/dengage-registry";
import HealthCheck from "./health-check";

export default function DashboardPage() {
  return (
    <div>
      <h1>Available APIs</h1>
      <p className="muted">
        Click any API below to open the live demo. Requests are proxied through this portal
        so your Dengage credentials never leave the server and the outbound IP stays whitelisted.
      </p>

      <HealthCheck />

      <div className="cards">
        {endpoints.map((e) => (
          <Link key={e.id} href={`/dashboard/${e.id}`} className="card">
            <div style={{ marginBottom: 10 }}>
              <span className={`method-tag method-${e.method}`}>{e.method}</span>
              <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                {e.path}
              </span>
            </div>
            <h3>{e.name}</h3>
            <p>{e.description}</p>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 32 }} className="muted">
        Want to add more APIs? Edit <code>src/lib/dengage-registry.ts</code> and append a new entry.
      </div>
    </div>
  );
}
