# Testing plan

Results (real command output only) are recorded in `docs/testing.md`, with automated and manual checks kept apart.

## Backend (Go, real PostgreSQL)

Tests run against a real database: locally Homebrew `postgresql@16`, in CI the GitHub Actions Postgres service. Each test gets a fresh schema. Checkout tests finish by running the **invariant checker** (see `architecture.md`).

**Catalog and search**
- Every filter alone and in combination; `total` equals a direct SQL count.
- Each sort order, with a stable tie-breaker so pages never overlap or skip.
- Pagination bounds (page 0, page past the end, page size limits).
- Search: exact title, partial word, prefix, one- and two-letter typos, different casing, empty query, no match, `%`/`_`/`\`/quotes, over-long query (400).

**Homepage**
- Changing `home_sections` (title, order, enabled) and `banners` rows changes `GET /api/home` and section output.
- Best sellers change after a paid order; deals change after a price change.

**Authentication and authorisation**
- Register (valid, duplicate email, weak password, password > 72 bytes); login (right, wrong, unknown email).
- Session: new token per login; logout invalidates; idle and absolute expiry; cookie attributes in prod mode.
- Cross-origin POST rejected (403); non-JSON body rejected (415); signed-out cart/order requests 401; another user's order 404.
- No endpoint except a paid order's detail ever returns key codes.

**Checkout**
- 50 goroutines race for the last 3 keys → exactly 3 reserved, all distinct.
- Multi-item order where one item lacks stock → nothing reserved.
- 10 concurrent creates with the same idempotency key → one order; same key with a different body → 422.
- Price change → 409 with current prices; inactive offer → 409.
- Decline then success; double success → one effect; pay after expiry → 410 and keys back to available.
- Cancel releases keys; a new order cancels the user's previous pending order.
- Quantity 3 → 3 distinct keys.
- Fault injection: an error forced after the reservation step → full rollback, no reserved keys.
- **Mixed stress:** creates, pays, cancels and sweeps running concurrently, repeated with `-race -count=N` → no deadlock (SQLSTATE 40P01), invariant holds, no key owned twice, no reserved key on a non-pending order.

## Frontend (Vitest + Testing Library) — a few high-value tests

- Filters ↔ URL query string round-trip.
- Guest cart storage and merge payload.
- Homepage section registry renders by type and tolerates unknown types.
- Money formatting.

## End-to-end (Playwright)

Runs locally and against production (`BASE_URL=https://…`).
1. **Main journey (diagram):** homepage → product → choose a non-cheapest seller → cart → checkout → sign in → demo payment → order page shows key → order history shows the same key.
2. Same journey entering through a typo search ("starfal odysey").
3. Signed-out checkout redirects to login and returns with the cart intact.
4. Decline → retry → success.
5. Mobile viewport: menu, search, card grid, product page, checkout.
6. Homepage reflects a DB change (local only).
7. `style.spec.ts`: computed-style checks (page background, CTA colour, font family, card panel colour, header heights, square corners).

## Visual acceptance

1. `e2e/visual/capture-reference.ts` saves eneba.com screenshots (home, store, product, login, 404) at 1280×800 and 375×812 into `design/reference/` (local only).
2. `e2e/visual/capture-app.ts` saves the same screens of our app into `docs/design/app/`.
3. The screenshots are opened and compared by eye side by side (not only via tokens). Findings go to `docs/design/visual-review.md`: screen, viewport, difference, severity (high/medium/low), fix, status.
4. A screen is accepted only when it has no open *high* differences at both widths. Reviews happen at the end of days 3, 4 and 6.

## Discipline

For each milestone: implement → run checks → test → investigate failures → fix the root cause → re-run → record. A feature is "done" only with linked evidence.
