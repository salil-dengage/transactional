import Link from "next/link";
import { categoryMeta, endpointsByCategory, type EndpointCategory } from "@/lib/dengage-registry";
import HealthCheck from "./health-check";

const CATEGORY_ORDER: EndpointCategory[] = [
  "messaging",
  "audience",
  "events",
  "campaigns",
  "data",
  "reports",
  "other",
];

export default function DashboardPage() {
  const grouped = endpointsByCategory();

  return (
    <div>
      <h1>Dengage API Showcase</h1>
      <p className="muted" style={{ maxWidth: 760 }}>
        Click any API to run a live demo. Each endpoint has a <strong>Functional</strong> view
        (scenarios + friendly form + rendered outcome for non-technical stakeholders) and a{" "}
        <strong>Developer</strong> view (raw JSON + response + copy-as-curl). Requests are proxied
        through this portal so your Dengage credentials stay server-side and the outbound IP
        remains whitelisted.
      </p>

      <HealthCheck />

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped[cat];
        if (list.length === 0) return null;
        return (
          <section key={cat} style={{ marginTop: 28 }}>
            <h2 style={{ margin: "0 0 4px 0" }}>{categoryMeta[cat].label}</h2>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              {categoryMeta[cat].blurb}
            </div>
            <div className="cards">
              {list.map((e) => (
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
          </section>
        );
      })}

      <div style={{ marginTop: 40 }} className="muted">
        Adding more APIs? Edit <code>src/lib/dengage-registry.ts</code>. The portal picks up new
        entries, routes them into the right category, and renders them with the Functional +
        Developer tabs automatically.
      </div>
    </div>
  );
}
