# Architecture

## Overview

```
Browser ──► Vercel (React SPA, static files)
              │  rewrite /api/*  (same origin for the browser)
              ▼
            Render (Go API, single binary) ──► Neon (PostgreSQL)
```

- One Go service (modular monolith) and one React app in one repository.
- The browser only talks to the Vercel domain. Vercel forwards `/api/*` to Render, so the session cookie is first-party and no CORS is needed in production.

## Repository layout

```
web/                  React 19 + TypeScript + Vite
  src/styles/tokens.css   design tokens (single source of colours/sizes)
  src/components/         shared UI (Header, ProductCard, Price, Button …)
  src/features/           home, store, product, cart, auth, checkout, orders
  src/api/                typed fetch client
api/
  cmd/server            HTTP server: config, DB pool, migrations, routes
  cmd/seed              idempotent demo-data seeding
  internal/catalog      products, filters, facets, search
  internal/home         section registry + one provider per block type
  internal/auth         users, sessions, middleware
  internal/cart         cart items
  internal/orders       orders, key reservation, demo payment, history
  internal/keys         AES-GCM encryption of key codes
  internal/httpx        JSON helpers, errors, logging, rate limiting
  migrations/           SQL migrations (goose, embedded in the binary)
e2e/                  Playwright tests (local and production)
scripts/              transcript export, asset generation
docs/
```

Each backend module has three small layers: **handler** (HTTP in/out), **service** (business rules, transactions), **store** (SQL). There is no framework or DI container; `main.go` wires everything by hand.

Libraries: Go standard library `net/http` router (method + path patterns), `pgx/v5`, `goose`, `golang.org/x/crypto/bcrypt`, `log/slog`. Frontend: React Router, TanStack Query, CSS Modules.

## Data model

Money is stored as integer cents (`bigint`), all times as `timestamptz`.

| Table | Purpose | Key constraints |
|---|---|---|
| `users` | Accounts | `email citext unique` |
| `sessions` | Server-side login sessions | `token_hash unique`; FK user (cascade) |
| `platforms`, `regions`, `product_types` | Filter dimensions | `slug unique` |
| `products` | A sellable item, e.g. "Starfall Odyssey (PC) Steam Key GLOBAL" | `slug unique`; FKs to platform/region/type; trigram index on `lower(title)` |
| `sellers` | Synthetic demo sellers with ratings | `slug unique` |
| `offers` | One seller's offer for one product: price, active flag | `unique(product_id, seller_id)`, `price_cents > 0` |
| `offer_keys` | One row per digital key | encrypted code; `code_fingerprint unique`; status `available/reserved/sold`; `order_item_id` FK; CHECK `(status = 'available') = (order_item_id IS NULL)` |
| `cart_items` | Signed-in user's cart | PK `(user_id, offer_id)`, quantity 1–10 |
| `orders` | Purchase | status `pending_payment/paid/cancelled/expired`; `unique(user_id, idempotency_key)`; `expires_at` |
| `order_items` | Line with price/title/seller snapshot | quantity 1–10 |
| `payment_attempts` | Each simulated payment try | `unique(order_id, idempotency_key)` |
| `home_sections` | Homepage layout: key, type, title, position, enabled, config | `key unique` |
| `banners` | Banner content for banner sections | FK section; time window |

**Why this shape.** A product and an offer are different things: one product has many sellers with their own price and stock. Keys are rows, so selling a key means locking and updating a specific row, which makes double-selling impossible to hide. Order items copy price, title and seller at purchase time so history stays correct if offers change later. A plain stock counter could not tell which key a buyer received; a deeper games → editions → variants hierarchy would add complexity the assignment doesn't need.

## Homepage: one backend source per block

- `GET /api/home` returns the enabled sections in order: `{key, type, title}`.
- `GET /api/home/sections/{key}` returns that section's content from its own provider:
  - `banner` → `banners` table (active time window)
  - `bestsellers` → paid order volume plus seeded popularity
  - `deals` → biggest discount of the lowest active offer against list price
  - `new_releases` / `upcoming` → release date
- The frontend has a registry `type → component`. It contains no product names, campaigns or section titles. Each section loads on its own, so one failing block doesn't break the page.

## Search

PostgreSQL `pg_trgm` (plus `unaccent` if available). Ranking: exact title match → title starts with query → title contains query (`ILIKE`, with `%`, `_`, `\` escaped) → trigram `word_similarity ≥ 0.3`; ties broken by popularity, then id. Empty query means "no text filter". Queries over 100 characters are rejected with 400. The same search powers the header suggestions (`/api/search/suggest`, top 6) and the store page (`/api/products?q=`).

## Checkout and key inventory

### The invariant

> A key is `available` exactly when it has no `order_item_id`. It is `reserved` only while its order is `pending_payment`, and `sold` only when its order is `paid`. Every order item has exactly `quantity` keys linked to it.

Tests run an SQL checker for this after every checkout scenario.

### Lock order (all paths)

1. `orders` rows, ascending id (`FOR UPDATE`)
2. `offers` rows, ascending id (`FOR SHARE`) — only in order creation
3. `offer_keys` rows, ascending `(offer_id, id)`

Every transaction takes locks in this order, which rules out lock-order deadlocks between create, pay, cancel and the expiry sweep. Tests run these operations concurrently and fail on any deadlock error (SQLSTATE 40P01).

### Transactions

All steps run in one database transaction each (READ COMMITTED + explicit row locks), so any error, crash or lost connection rolls everything back.

1. **Create order** — `POST /api/orders`, header `Idempotency-Key`, body `{items, expectedTotalCents}`
   1. *Cleanup transaction (committed separately, before the main one):* run the expiry sweep, then cancel this user's other pending orders (excluding one with the same idempotency key) so one user can't hoard stock. Doing this first keeps the main transaction's lock order strictly orders → offers → keys; cancelling an order the user is replacing is safe even if the new order later fails.
   2. *Main transaction:* insert the order with `ON CONFLICT (user_id, idempotency_key) DO NOTHING`. If it already exists: same request hash → return it; different request → 422. A concurrent duplicate waits on the unique index and then returns the first order.
   3. Lock the offers; missing/inactive → 409 `offer_unavailable`; total differs from `expectedTotalCents` → 409 `price_changed` with current prices.
   4. Insert order items with snapshots.
   5. For each item in ascending offer id: reserve `quantity` keys with `FOR UPDATE SKIP LOCKED`. Fewer than needed → roll back the whole order → 409 `out_of_stock`. Multi-item orders are all-or-nothing.
   6. Commit. Reservations last 15 minutes.
2. **Pay** — `POST /api/orders/{id}/payments`, header `Idempotency-Key`, body `{outcome: "success" | "decline"}`
   - Lock the order (owner only, else 404). Repeated attempt key → same result.
   - Already paid → return it. Cancelled/expired/overdue → expire and release in this transaction → 410.
   - Decline → record the attempt; order stays pending so the buyer can retry until it expires.
   - Success → record the attempt; change order `pending_payment → paid` with a compare-and-set update (must hit 1 row); change exactly Σquantity keys `reserved → sold` (otherwise roll back); remove bought offers from the cart.
3. **Cancel** — `POST /api/orders/{id}/cancel`: pending → cancelled, keys released.
4. **Expiry sweep** — marks overdue pending orders `expired` and releases their keys; runs inline before create/pay and every minute in the background, so stock recovers even after the free-tier server slept.

Keys are encrypted at rest (AES-256-GCM, key from `KEY_ENCRYPTION_KEY`) and decrypted only in `GET /api/orders/{id}` for the owner of a paid order. No other endpoint returns key material.

## Authentication and security

- Passwords: bcrypt (cost 12), 8–72 bytes, email normalised to lower case. Login errors are generic; an unknown email still runs a bcrypt comparison so timing doesn't reveal accounts.
- Sessions: random 32-byte token in the cookie, SHA-256 hash in the DB. A new session on every login/registration. Absolute lifetime 14 days, idle timeout 2 days. Logout deletes the session.
- Cookie: production `__Host-sid` (Secure, HttpOnly, SameSite=Lax, Path=/, no Domain); development `sid` on http://localhost.
- Cross-site request protection: Go's `http.CrossOriginProtection` on all state-changing requests (checks `Sec-Fetch-Site` / `Origin`), with the production Vercel origin and the local dev origin as trusted origins; SameSite=Lax; JSON-only request bodies. The production proxy's header forwarding is checked during the first deploy.
- Authorisation: every cart/order query filters by the session's user; foreign order ids return 404; order ids are UUIDs.
- Rate limiting on login/registration (per IP and per email, in memory — best effort on a single instance).
- Security headers set by Vercel: CSP, `nosniff`, referrer policy, `frame-ancestors 'none'`.

**Trade-off vs JWT:** server sessions can be revoked instantly and are simple to reason about; the cost is one indexed lookup per authenticated request, which is negligible here.

## API summary

| Method | Path | Auth |
|---|---|---|
| GET | `/api/healthz` | – |
| GET | `/api/home`, `/api/home/sections/{key}` | – |
| GET | `/api/products`, `/api/products/{slug}`, `/api/search/suggest` | – |
| GET | `/api/platforms`, `/api/regions`, `/api/types` | – |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | – / session |
| GET | `/api/auth/me` | session |
| GET, PUT, DELETE | `/api/cart`, `/api/cart/items/{offerId}`; POST `/api/cart/merge` | session |
| POST | `/api/orders`, `/api/orders/{id}/payments`, `/api/orders/{id}/cancel` | session |
| GET | `/api/orders`, `/api/orders/{id}` | session |

Errors use one JSON shape: `{"error": {"code": "out_of_stock", "message": "...", "details": {...}}}`.
