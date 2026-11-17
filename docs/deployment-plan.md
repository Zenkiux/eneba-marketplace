# Deployment plan

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
6. Check through the real proxy: `Origin` / `Sec-Fetch-Site` reach the API; the `__Host-sid` cookie is set on the Vercel domain; a cross-site POST is rejected. Record results in `docs/testing.md`.
7. Run Playwright against the production URL; then a manual pass in a clean browser profile.

## Cold starts

The app shows "Waking up the server…" when the first API call is slow; README documents the limitation. No keep-alive pinging is planned (it would just spend free hours).

## Secrets

Only in provider dashboards. `.env.example` lists names without values. `.env*` is gitignored; the transcript exporter redacts connection strings and known secret variables.
