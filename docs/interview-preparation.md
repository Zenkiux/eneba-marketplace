# Interview preparation

A study guide to the code, written so you can explain every part in your own words. Paths are relative to the repository root; line numbers are approximate.

## 1. The 60-second summary

keyshop is an Eneba-style marketplace: a **React + TypeScript** single-page app talking to a **Go REST API** backed by **PostgreSQL**. Visitors browse a catalog with server-side filters and typo-tolerant search, compare several sellers' offers for a product, put the chosen offer in a cart, sign in, pay with a simulated payment, and receive a digital key. The hard part — and where most of the testing went — is making sure **a key can never be sold twice and is never left stuck in an abandoned checkout**, even with many buyers at once, double clicks and retries.

## 2. How a request flows

```
Browser → Vercel (static React app)
        → /api/* rewritten to Render → Go server
            securityHeaders → logRequests → CrossOriginProtection → auth.Middleware → catalog.SourceMiddleware → router → handler → service/store → PostgreSQL
```

- Wiring: `api/internal/app/app.go` (`NewRouter`). Entry point: `api/cmd/server/main.go` (config, DB pool, migrations, optional first-boot seed, background order sweeper, graceful shutdown).
- Every module follows **handler** (HTTP in/out) → **service/store** (rules + SQL). No framework, no dependency-injection container: `NewRouter` builds things by hand.
- Errors: handlers return errors; `httpx.Handler` turns them into one JSON shape `{"error":{"code","message","details"}}`. Unknown errors become a logged 500 with a generic message (`api/internal/httpx/httpx.go`).

## 3. Feature walkthroughs

### Store (catalog)
- `api/internal/catalog/store.go`
  - `CardSelect` — one SQL fragment for every product card. A `LATERAL` subquery finds the **cheapest active offer that still has an available key**; `NULL` means sold out.
  - `Filter.where` builds the WHERE clause with **named parameters** (never string-concatenated user input). The `skip` argument powers the facet counts: each filter group is counted with all *other* filters applied, like Eneba's counts.
  - `List` = items (with `ORDER BY <sort>, p.id` — the id tie-breaker keeps pagination stable) + total + three facet queries.
- `api/internal/catalog/handler.go` → `ParseFilter` validates every query parameter (400 for junk).
- Frontend: `web/src/features/store/storeQuery.ts` converts **URL ↔ state ↔ API query** (pure functions, unit-tested); `StorePage.tsx` renders filters, chips, sort, grid, pagination.

### Search
- Same query as the store with `q`: matches if the title **contains** the text (`LIKE`, with `%`, `_`, `\` escaped by `escapeLike`) **or** `word_similarity(q, title) ≥ 0.45` (PostgreSQL `pg_trgm` trigram similarity).
- Ranking (`sorts["relevance"]`): exact → prefix → substring → similarity → popularity.
- Why 0.45: measured on our titles — 1–2-letter typos scored 0.64–0.75, unrelated words ~0.17 (decision 11).
- Header box: `web/src/components/SearchBox/SearchBox.tsx` — debounced suggestions (`/api/search/suggest`), ARIA combobox (arrow keys, Enter, Escape).

### Homepage (backend-driven)
- `api/internal/home/home.go`: `home_sections` table = which blocks, order, titles, config. `providers` maps a block **type** to a function that loads its content: banners table, categories, best sellers (paid order volume), deals (biggest discount), new releases, upcoming.
- `GET /api/home` returns the layout; `GET /api/home/sections/{key}` returns one block.
- Frontend: `web/src/features/home/HomePage.tsx` + `sections/registry-components.tsx` — maps type → component. **No product, title or campaign is written in React code.** Each block fetches separately, so one failure doesn't blank the page.
- Proven by `api/internal/home/home_test.go` and `e2e/tests/home-db.spec.ts` (edit DB rows → page changes).

### Product page and offers
- `catalog.Store.Product`: product + all active offers with live stock counts (only `count(*)` of keys — key codes are never selected).
- `web/src/features/product/ProductPage.tsx`: featured offer = cheapest in stock; every offer row has its own buttons that add **that offer id** to the cart.

### Cart
- Guest: `web/src/features/cart/guestCart.ts` keeps only `{offerId, quantity}` in `localStorage`; `GET /api/offers?items=12:1,40:2` resolves live prices/stock.
- Signed in: `api/internal/cart/cart.go` (`cart_items` table). `Merge` adds the guest lines at sign-in (`web/src/api/auth.ts`).
- `web/src/features/cart/useCart.ts` gives the whole app one interface for both modes.

### Authentication
- `api/internal/auth/auth.go`: bcrypt cost 12; 8–72-byte passwords (bcrypt ignores bytes after 72, so we reject instead of silently truncating); unknown e-mail still runs a dummy bcrypt compare (timing).
- Sessions: 32 random bytes → cookie; DB stores **SHA-256(token)**, so a DB leak doesn't expose usable sessions. New session on every sign-in; 14-day absolute and 2-day idle expiry.
- `api/internal/auth/http.go`: `Middleware` resolves the cookie into a user; `RequireUser` returns 401. Production cookie `__Host-sid` (Secure, HttpOnly, SameSite=Lax, Path=/, no Domain).
- Frontend guard `RequireAuth.tsx` is only UX; the API enforces everything.

### Checkout, payment, keys — the core
All in `api/internal/orders/service.go`. The rules (top of the file):

> available key ⇔ no `order_item_id`; reserved ⇒ order pending; sold ⇒ order paid; a pending/paid item has exactly `quantity` keys.

The database enforces part of it with `CHECK ((status = 'available') = (order_item_id IS NULL))` (`api/migrations/00001_init.sql`).

**Create** (`Create`, ~line 115):
1. Validate input; hash the normalised request.
2. *Cleanup transaction:* `Sweep` (expire overdue orders, return keys) and `cancelOtherPending` (one open checkout per user).
3. *Main transaction*, locks in the global order **orders → offers → keys**:
   - `INSERT … ON CONFLICT (user_id, idempotency_key) DO NOTHING` — a repeat returns the existing order (same hash) or 422 (different cart). A concurrent duplicate waits on the unique index, then sees the committed order.
   - Lock offers `FOR SHARE`, recompute the total; mismatch → 409 `price_changed`.
   - For each line: `UPDATE offer_keys SET status='reserved' … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT qty)`. `SKIP LOCKED` makes concurrent buyers take *different* rows instead of queueing; a row can be updated only once, so no key can be reserved twice. Fewer rows than requested → 409 and the **whole** transaction rolls back.

**Pay** (`Pay`, ~line 323): lock the user's order row; replayed attempt key → same result; already paid → no-op; expired → mark expired + release keys → 410; decline → record attempt, keep reservation → 402; success → record attempt, `pending→paid` with a compare-and-set update, `reserved→sold` must touch exactly Σquantity rows (otherwise roll back), remove bought items from cart.

**Read** (`read.go`): `Get` filters by `user_id` (another user's order = 404, same as non-existent), decrypts keys (AES-256-GCM, `api/internal/keys/keys.go`) **only for paid orders**.

Frontend: `web/src/api/orders.ts` (idempotency key per cart+total in `sessionStorage`; fresh key per payment click), `features/checkout/*`, `features/orders/*`, `features/account/OrdersPage.tsx`.

### Optional Eneba catalog
- `products.catalog` = `demo` (default) or `eneba` (`api/migrations/00002_catalog_source.sql`). The browser sends `X-Catalog: eneba` when the switch is on (`web/src/api/catalogChoice.ts`, `client.ts`); `catalog.SourceMiddleware` puts it in the request context; catalog and homepage queries filter by it.
- Data: `e2e/tools/scrape-eneba.mjs` (one-off, polite, robots.txt-allowed pages) → gitignored `data/eneba-snapshot.json` → `api/cmd/import-eneba`. Real titles, cover URLs, prices; demo sellers; fake keys; visible banner.

## 4. Testing story

- **Go integration tests on a real PostgreSQL.** `api/internal/testdb/testdb.go` builds one migrated+seeded *template* database and clones it per test (`CREATE DATABASE … TEMPLATE`, milliseconds) → isolation and real SQL behaviour, packages run in parallel.
- **The invariant checker** (`checkInvariant` in `api/internal/orders/orders_test.go`) runs after every checkout scenario.
- Highlights: 50 buyers vs 3 keys → exactly 3 winners; 10 identical concurrent creates → 1 order; 8 concurrent pays → 1 payment; fault injection after reservation → full rollback; mixed stress (12 workers × 25 random create/pay/decline/cancel/expire steps) → no deadlocks, invariant holds, key count unchanged.
- **Playwright** (`e2e/tests`): both entry points of the diagram end to end, deliberately choosing the *most expensive* seller to prove the chosen offer is what gets bought.
- Bugs the tests caught (good interview stories, details in `docs/testing.md`):
  1. Seed wasn't idempotent — random sequence shifted when existing offers were skipped.
  2. Alphabetical sort differed between macOS and Linux (`en_US.UTF-8` collations differ) → `COLLATE "C"`; caught by CI.
  3. The stress test first passed while doing nothing (Go evaluates `prices[offerIDs[i]]` before the assignment) → now it fails unless every path happened.
  4. Mutation check: removing LIKE escaping made `%` match all 58 products → the search test catches it.

## 5. Decisions and trade-offs (short answers)

| Question | Answer |
|---|---|
| Why Go + stdlib router? | Small, explicit, fast; Go 1.22+ routing has methods and path params; nothing to learn beyond the language. |
| Why a monolith if blocks need "their own service"? | Each block has its own provider and endpoint; separate deployables would add ops cost and failure modes without any evaluated benefit. |
| Why server sessions, not JWT? | Instant revocation on logout, nothing sensitive in the browser, simple. Cost: one indexed lookup per request. |
| How is CSRF prevented? | `SameSite=Lax` cookie + Go's `CrossOriginProtection` (checks `Sec-Fetch-Site`/`Origin` on non-GET) + JSON-only bodies (a cross-site HTML form can't send `application/json`). Tested. |
| Why Vercel rewrite to Render? | Browser sees one origin → first-party cookie, no CORS, works in Safari. |
| Why keys as rows, not a stock counter? | A counter can't say *which* key a buyer got; rows + row locks make double-selling structurally impossible and testable. |
| Why `SKIP LOCKED`? | Buyers don't wait for each other; each takes a different free key. |
| Why idempotency keys? | Double clicks, refreshes and network retries return the first result instead of creating a second order or payment. |
| What if the server crashes mid-checkout? | Everything is one transaction → rolled back. Reserved-but-unpaid keys expire in 15 minutes and are swept back (inline and every minute). |
| Why is a declined payment not final? | Real UX: you retry with another card. Keys stay reserved until expiry or cancel. |
| Why simulated payment? | Allowed by the PDF; the order/payment lifecycle on the server is real and tested; no card data collected. |
| Money type? | Integer cents (`bigint`), never floats. |
| How is the homepage "not hardcoded"? | React only maps block type → component; layout and content come from the DB, proven by tests that edit rows. |
| What would you do next? | Real payment provider in test mode with webhooks; Redis-backed rate limiting; a small admin UI for homepage sections; image CDN for covers. |

## 6. How AI was used (say it plainly)

ChatGPT helped analyse the assignment and wrote the initial planning prompt; Claude Code (agentic) researched eneba.com, planned, wrote the code and tests, and ran them. I approved the plan, made the product decisions (scope, images, hosting, the Eneba switch), corrected the plan when needed (e.g. transcript completeness, unapproved image use, deadline, checkout locking) and reviewed every milestone. The full, unedited conversation is in `docs/agent-chat-history.md`. Be ready to open any file above and explain it line by line.

## 7. Demo script (5 minutes)

1. Homepage → point out blocks come from `/api/home` (optionally flip a row in `home_sections`).
2. Search "starfal odysey" → typo tolerance.
3. Store → filter Steam + price range → URL updates → back button.
4. Product → compare offers → add the *second* seller.
5. Cart → "Log in and checkout" → register → checkout → **decline** → **success** → key.
6. My orders → same key.
7. Optional: flip the **Eneba catalog** switch → real listings, banner.
8. Show `orders/service.go` Create + the race test.
