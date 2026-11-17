# Decision log

Short records of decisions that shape the project. Newest last.

| # | Date | Decision | Why | Alternatives considered |
|---|---|---|---|---|
| 1 | 2026-11-17 | Go REST API + React/TS (Vite) + PostgreSQL, modular monolith | Matches the PDF's stack; one deployable is easy to run, test and explain | PHP; GraphQL; microservices per homepage block |
| 2 | 2026-11-17 | Vercel rewrites `/api/*` to Render | Browser sees one origin → first-party session cookie, no CORS | Cross-site cookies (blocked by Safari/ITP); serving the SPA from Go (cold start hits the whole site) |
| 3 | 2026-11-17 | Neon for Postgres | Render's free Postgres expires; Neon's free tier persists | Render Postgres, Supabase |
| 4 | 2026-11-17 | Keys as rows with status + `order_item_id` and a CHECK constraint; reservation with `FOR UPDATE SKIP LOCKED` | Makes double-selling structurally impossible and testable | Stock counter column |
| 5 | 2026-11-17 | One lock order everywhere: orders → offers → keys; order-creation cleanup in its own transaction | Rules out lock-order deadlocks between create, pay, cancel and sweep | Single big transaction (would take an order lock after key locks) |
| 6 | 2026-11-17 | Simulated payment with success/decline buttons, no card fields | PDF allows simulation; no reason to collect card-like data | Stripe test mode |
| 7 | 2026-11-17 | Server sessions in `__Host-` cookie + Go `http.CrossOriginProtection` | Revocable, simple, standard-library cross-site protection | JWT in localStorage; CSRF tokens |
| 8 | 2026-11-17 | Fictional catalog + own cover art from openly licensed photos; own wordmark | No rights to game artwork or Eneba's brand; public site must not impersonate | Hotlinking store art (rejected: no permission) |
| 9 | 2026-11-17 | Transcript exported from Claude Code's JSONL by our own script with hash verification; raw JSONL kept private | Full, checkable history without leaking personal data | Manual copy/paste; CLI `/export` only (not available in desktop app) |
| 10 | 2026-11-17 | Ship generated cover art for all 27 titles; keep the photo option in the renderer (`--photos`) but don't ship photos | Side-by-side in Eneba's card layout ([art-comparison.png](design/art-comparison.png)): generated covers are brighter, have a clear focal subject and stay readable at card size, like Eneba's key art. Of the four photos, only the neon street held up; the landscape photos read as dark, muddy thumbnails. One consistent style across the catalog also avoids per-image licence tracking | Licensed Unsplash photos per title; mixing both styles |
