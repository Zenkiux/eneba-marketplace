# Deployment

## Live: https://keyshop.zenkiux.com (deployed 2026-11-17)

| Part | Where | Notes |
|---|---|---|
| Website + API | Go server on the owner's always-on Mac (`~/.keyshop/bin/server`) | Serves the built React app and `/api` from one origin; listens on `127.0.0.1:8090` only |
| Database | PostgreSQL 16 on the same Mac (`keyshop_prod`) | Homebrew service, starts at boot; separate from the development database |
| Public access | Cloudflare Tunnel (free plan), tunnel `keyshop` | Outbound-only connection to Cloudflare; DNS `keyshop.zenkiux.com` → tunnel; only that hostname is routed, everything else 404 |

Chosen by the owner over Vercel/Render/Neon: no cold starts, own domain for the portfolio, link shared privately with the Eneba team. Trade-off: availability depends on the Mac being on and online. Cloudflare Tunnel is a free-tier service, but the PDF's example is a cloud host, so the cloud setup below stays ready as a fallback.

### How it runs
- `scripts/mac-host/deploy.sh` builds the API and website, copies them to `~/.keyshop`, writes launchd agents and (re)starts them:
  - `com.zenkiux.keyshop.api` — `set -a; . ~/.keyshop/prod.env; exec ~/.keyshop/bin/server` (RunAtLoad, KeepAlive)
  - `com.zenkiux.keyshop.tunnel` — `cloudflared tunnel run keyshop` (RunAtLoad, KeepAlive)
- `scripts/mac-host/deploy.sh status` shows both services and the health check. Logs: `~/.keyshop/logs/`.
- Secrets: `~/.keyshop/prod.env` (chmod 600): `APP_ENV=prod`, `LISTEN_ADDR`, `DATABASE_URL`, `KEY_ENCRYPTION_KEY` (generated with `openssl rand -base64 32`, never printed), `TRUSTED_ORIGINS=https://keyshop.zenkiux.com`, `STATIC_DIR`, `SEED_IF_EMPTY=true`. Tunnel credentials: `~/.cloudflared/` (chmod 600).
- Migrations run on start; the empty production database seeded itself on first start.
- Eneba snapshot imported with `set -a; . ~/.keyshop/prod.env; ~/.keyshop/bin/import-eneba -file data/eneba-snapshot.json`.

### Production behaviour
- HTTPS by Cloudflare; plain HTTP is redirected to HTTPS by the app (`X-Forwarded-Proto`).
- Cookie `__Host-sid; Secure; HttpOnly; SameSite=Lax; Path=/`.
- Headers: CSP (self + Eneba image CDN), `X-Frame-Options: DENY`, HSTS, `X-Robots-Tag: noindex, nofollow`, `nosniff`; API `Cache-Control: no-store`.
- Rate limiting uses `CF-Connecting-IP` (the server is reachable only through the tunnel).

### Redeploy after a change
```bash
scripts/mac-host/deploy.sh
```

## Fallback: free cloud hosting (not used)

| Part | Service (free tier) | Notes |
|---|---|---|
| Frontend | Vercel (Hobby) | Root `web/`; `vercel.json` rewrites `/api/:path*` to the Render URL, SPA fallback, security headers |
| API | Render free web service | Go native build from `api/`; health check `/api/healthz`; sleeps after ~15 min idle (cold start up to about a minute) |
| Database | Neon free Postgres | Persistent; chosen because Render's free Postgres expires |

### Free-tier terms (checked 2026-11-17 on the providers' docs)

- **Render free web service** (render.com/docs/free): spins down after 15 minutes without traffic; spin-up takes about a minute, and Render shows its own loading page to browsers meanwhile. Filesystem is ephemeral (we store nothing locally). Render's free Postgres expires 30 days after creation, which is why the database is on Neon.
- **Neon Free** (neon.com/docs/introduction/plans): $0/month, 100 CU-hours per project per month, 1 GB storage per project, compute scales to zero after 5 minutes idle, 6-hour restore window. Our seeded data is a few MB.
- **Vercel Hobby**: free for personal, non-commercial projects; supports rewrites to external URLs, which we use for `/api`.

Consequence for the app: a request that arrives while Render is asleep can take ~1 minute or return Render's HTML loading page instead of JSON. The API client treats a non-JSON response as "server waking up" and retries with a visible notice.

## Steps (day 2)

1. You create Vercel, Render and Neon accounts (GitHub sign-in). I never enter or see passwords.
2. Neon: create project + database; copy the pooled connection string into Render's env vars yourself (or paste into the dashboard when prompted).
3. Render: New → Blueprint from the GitHub repo (`render.yaml`: root `api/`, build `go build -o bin/server ./cmd/server`, start `./bin/server`). Env: `DATABASE_URL`, `KEY_ENCRYPTION_KEY` (32 random bytes, base64), `APP_ENV=prod`, `TRUSTED_ORIGINS=https://<vercel-domain>`. Migrations run on boot.
4. Seeding: `SEED_IF_EMPTY=true` (in `render.yaml`) makes the server seed an empty database on first boot; later restarts leave data alone. Render's free tier has no shell or one-off jobs.
5. Vercel: import repo, root directory `web/` (settings come from `web/vercel.json`); replace `RENDER_SERVICE_HOST` in `web/vercel.json` with the Render hostname.
5b. Optional Eneba catalog: from your laptop, `cd e2e && node tools/scrape-eneba.mjs` (writes `data/eneba-snapshot.json`, gitignored), then `cd api && DATABASE_URL=<Neon URL> KEY_ENCRYPTION_KEY=<same key as Render> APP_ENV=prod TRUSTED_ORIGINS=<vercel origin> go run ./cmd/import-eneba`. The switch appears automatically once the snapshot is in the database.
6. Check through the real proxy: `Origin` / `Sec-Fetch-Site` reach the API; the `__Host-sid` cookie is set on the Vercel domain; a cross-site POST is rejected. Record results in `docs/testing.md`.
7. Run Playwright against the production URL; then a manual pass in a clean browser profile.

## Cold starts

The app shows "Waking up the server…" when the first API call is slow; README documents the limitation. No keep-alive pinging is planned (it would just spend free hours).

## Secrets

Only in provider dashboards. `.env.example` lists names without values. `.env*` is gitignored; the transcript exporter redacts connection strings and known secret variables.
