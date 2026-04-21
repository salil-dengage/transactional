import Link from "next/link";

export default function NavBar() {
  return (
    <div className="nav">
      <div className="nav-title">
        <Link href="/dashboard" style={{ color: "inherit" }}>
          Dengage API Showcase
        </Link>
        <span>internal demo portal</span>
      </div>
      <form method="POST" action="/api/auth/logout">
        <button className="secondary" type="submit">Sign out</button>
      </form>
    </div>
  );
}
