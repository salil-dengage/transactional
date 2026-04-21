import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Dengage API Showcase</h1>
        <p>Internal demo portal. Enter the shared team password to continue.</p>
        {searchParams.error ? (
          <div className="error-banner">Incorrect password. Please try again.</div>
        ) : null}
        <LoginForm nextPath={searchParams.next || "/dashboard"} />
      </div>
    </div>
  );
}
