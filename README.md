# Dengage API Showcase Portal

Internal web portal for Dengage team members to demo Dengage APIs live to
prospects. Currently ships with **Send Transactional Email**; designed so
adding more Dengage APIs is a single-file edit.

## How it works

```
Team member's browser
    │  (portal login: shared password)
    ▼
Portal backend (Next.js, on a host with a stable IP)
    │  1. auto-logs in to Dengage, caches access token
    │  2. proxies the demo request, attaching the token
    ▼
Dengage API (https://api.dengage.com/rest)
```

Why a backend proxy:

- **IP whitelisting** — Dengage whitelists the portal server's IP, not every
  team member's laptop.
- **Credentials stay server-side** — Dengage userkey/password never touch the
  browser.
- **Token caching** — `/login` is called once and cached until expiry (or on
  401), so demos are snappy and we don't hammer the login endpoint.

## Local dev

```bash
cp .env.example .env.local
# edit .env.local with real DENGAGE_USERKEY, DENGAGE_PASSWORD,
# PORTAL_PASSWORD, SESSION_SECRET
npm install
npm run dev
# open http://localhost:3000
```

Generate a strong `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Note: when running locally your machine's outbound IP must be whitelisted in
> Dengage, otherwise `/login` will fail. The **Connection check** button on the
> dashboard will show you a clear error.

## Deploy free to Fly.io (recommended)

Fly.io gives you a dedicated static IPv4 so Dengage IP whitelisting works,
and the first ~$5/month of usage is free credit.

```bash
# one-time
brew install flyctl                     # or: curl -L https://fly.io/install.sh | sh
fly auth signup                         # or: fly auth login

# in this repo
fly launch --copy-config --no-deploy    # accepts the included fly.toml
fly ips allocate-v4                     # <-- this IP is what you give Dengage to whitelist
fly secrets set \
  DENGAGE_BASE_URL=https://api.dengage.com/rest \
  DENGAGE_USERKEY=... \
  DENGAGE_PASSWORD=... \
  PORTAL_PASSWORD=<strong-shared-pass> \
  SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))") \
  DEFAULT_DEMO_RECIPIENT=salil.gupta@dengage.com

fly deploy
```

After deploy: open `https://dengage-api-showcase.fly.dev` (or your configured
hostname), log in with the shared password, and hit **Test login to Dengage**
on the dashboard to confirm the whitelisting works.

## Alternative free host: Oracle Cloud Always Free

Truly free forever (ARM VM + 1 reserved public IPv4). More setup:

1. Sign up at cloud.oracle.com, pick **Always Free** tier.
2. Create an Ampere A1 VM (ARM) with Ubuntu 22.04, and a **Reserved Public IP**.
3. SSH in, install Docker: `curl -fsSL https://get.docker.com | sh`.
4. Clone this repo, build and run:
   ```bash
   docker build -t dengage-portal .
   docker run -d --restart unless-stopped -p 80:3000 \
     -e DENGAGE_USERKEY=... -e DENGAGE_PASSWORD=... \
     -e PORTAL_PASSWORD=... -e SESSION_SECRET=... \
     -e DEFAULT_DEMO_RECIPIENT=salil.gupta@dengage.com \
     --name portal dengage-portal
   ```
5. Give Dengage the VM's reserved public IP to whitelist.

## Extending with more Dengage APIs

Edit `src/lib/dengage-registry.ts` and append an entry:

```ts
{
  id: "create-contact",
  name: "Create Contact",
  description: "Create or update a Dengage contact.",
  docsUrl: "https://dev.dengage.com/reference/createcontact",
  method: "POST",
  path: "/contact",                     // relative to DENGAGE_BASE_URL
  defaultPayload: () => ({
    contactKey: "demo@example.com",
    firstName: "Demo",
  }),
  notes: ["Adjust fields to match your Dengage data model."],
}
```

That's it — the new endpoint shows up on the dashboard and has a full live
demo page. No other code changes required.

## File map

```
src/
  app/
    login/                     portal login page
    dashboard/                 list of APIs + per-endpoint demo pages
    api/
      auth/                    portal sign-in / sign-out
      dengage/[endpointId]/    proxy to Dengage, attaches cached token
      dengage-health/          "test login to Dengage" helper
  lib/
    dengage-client.ts          login + token cache + callDengage()
    dengage-registry.ts        <-- add new APIs here
    session.ts                 signed cookie for portal auth
    env.ts                     env var reader
  middleware.ts                gates all routes behind portal login
```

## Security notes

- `.env.local` is gitignored — real credentials never get committed.
- Portal session uses an HMAC-signed `httpOnly` cookie (12h TTL).
- Dengage token is held in process memory only; refreshed on expiry/401.
- Portal login is behind a shared password — fine for a small team; swap for
  SSO later if needed.
- This app is pinned to Next.js 14.2.35. There are outstanding DoS advisories
  (image optimizer, RSC request handling) that are only fixed in Next.js 16,
  which would require a breaking upgrade. Impact on this tool is minimal
  (internal, behind login, no image optimizer usage), but you can bump Next
  when convenient.

## Operational tips for demos

- **Always hit "Test login to Dengage" before the demo** — catches IP
  whitelisting / credential drift in 2 seconds.
- Pre-fill realistic payloads. Prospects trust what they can see happening.
- **Copy as curl** lets the prospect replay the exact call themselves.
- Keep a safe default recipient (`DEFAULT_DEMO_RECIPIENT`) so nobody
  accidentally sends a demo email to a real customer.
