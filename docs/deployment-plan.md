# Deployment plan

| Part | Service (free tier) | Notes |
|---|---|---|
| Frontend | Vercel (Hobby) | Root `web/`; `vercel.json` rewrites `/api/:path*` to the Render URL, SPA fallback, security headers |
| API | Render free web service | Go native build from `api/`; health check `/api/healthz`; sleeps after ~15 min idle (cold start up to about a minute) |
| Database | Neon free Postgres | Persistent; chosen because Render's free Postgres expires |

Current free-tier limits are re-checked on the providers' pages before setup and recorded here.

## Steps (day 2)

1. You create Vercel, Render and Neon accounts (GitHub sign-in). I never enter or see passwords.
2. Neon: create project + database; copy the pooled connection string into Render's env vars yourself (or paste into the dashboard when prompted).
3. Render: new Web Service from the GitHub repo, root `api/`, build `go build -o bin/server ./cmd/server`, start `bin/server`. Env: `DATABASE_URL`, `KEY_ENCRYPTION_KEY` (32 random bytes, base64), `APP_ENV=prod`, `TRUSTED_ORIGINS=https://<vercel-domain>`. Migrations run on boot.
4. Seed once: Render shell / one-off job `bin/seed` (idempotent).
5. Vercel: import repo, root `web/`, framework Vite; set the rewrite target.
6. Check through the real proxy: `Origin` / `Sec-Fetch-Site` reach the API; the `__Host-sid` cookie is set on the Vercel domain; a cross-site POST is rejected. Record results in `docs/testing.md`.
7. Run Playwright against the production URL; then a manual pass in a clean browser profile.

## Cold starts

The app shows "Waking up the server…" when the first API call is slow; README documents the limitation. No keep-alive pinging is planned (it would just spend free hours).

## Secrets

Only in provider dashboards. `.env.example` lists names without values. `.env*` is gitignored; the transcript exporter redacts connection strings and known secret variables.
