# Test results log

Real results only. Automated and manual checks are listed separately.

## 2026-11-17 — transcript pipeline

Automated (command output):
- `transcripts.py export` → `exported 1 session file(s) …`; `verify` → `checked … blocks … : OK` (only warning: ChatGPT link placeholder).
- Tamper test 1: changed "Planning" → "Planing" in the first prompt → `FAIL: content mismatch in block 868fdc42-…:0 (user)`, exit 1.
- Tamper test 2: appended a line to `results/toolu_01Gg….txt` → `FAIL: result file differs from source`, exit 1.
- Private-string scan of `docs/` after redaction fix → no hits.

Manual:
- Desktop app Export zip compared with the live JSONL: 169/169 messages present in live file.
- Stop-hook command run by hand → export + verify OK, log written.

## 2026-11-17 — day 1 skeleton

Automated:
- `go vet ./... && go build ./... && go test ./...` (api) → pass; `internal/keys` round-trip/tamper/fingerprint test ok.
- Server smoke: `GET /api/healthz` → `{"status":"ok"}`; unknown `/api/nope` → 404 JSON error; `POST` with `Origin: https://evil.example`, `Sec-Fetch-Site: cross-site` → 403 `cross_origin`.
- Migrations applied on start: 15 tables + goose version table.
- Seed: `seed -reset` → 58 products, 231 offers, 2799 keys; 0 duplicate fingerprints; every product has stock; 19 offers sold out.
  - Bug found: a second run added 157 keys and changed prices (random sequence shifted when existing offers were skipped). Fixed by drawing all random values before any early exit. After the fix, three consecutive runs gave the same md5 over (offer id, price, key count) and added 0 keys.
- Web (`web/`): typecheck, eslint, stylelint, vitest (8 money-format tests), vite build → all pass (run by the scaffolding sub-agent; lint rules shown to reject `#fff` and `border-radius: 4px`).

Manual (browser):
- Vite dev server + API: `localhost:5173/api/healthz` proxied → ok; home page shows "API status: ok"; body background rgb(70, 24, 172); Metropolis 400/700/800 loaded.

## 2026-11-17 — day 2: catalog, search, homepage APIs

Automated (`go test -count=1 ./...`, each test on its own clone of a migrated + seeded template DB):
- catalog: 9 tests pass — totals vs independent SQL counts for 9 filter combinations; every product reachable through pagination under all 8 sorts with no duplicates; sort order checks; facet counts; search matrix (exact, prefix, substring, casing, 2-typo, missing/swapped/wrong letter, nonsense, `%`, `_`, `\`, SQL-looking text, empty, >100 chars → 400); suggest; bad parameters → 400; product offers + stock match DB and contain no key material; sold-out cheapest offer moves the "From" price.
  - First run failed: "100%" fuzzily matched "Gift Card 10 EUR" (trigram similarity, not an escaping bug). Test case changed to a bare `%`.
  - Mutation check: with LIKE escaping removed, `%` and `_` each returned all 58 products and the test failed; restored → passes.
- home: 6 tests pass — reorder/rename/disable/add sections in DB changes `/api/home` and section output; banner edits and expiry; a product with 10 paid units becomes the top best seller; a price drop makes the top deal; upcoming vs new releases don't overlap; categories; unknown section → 404.
- Boot with `SEED_IF_EMPTY=true` on an empty database → seeded 58 products / 231 offers / 2799 keys, API served them.
- CI (GitHub Actions, Linux, `-race`): `TestSortOrders` failed — "alpha_desc out of order at 13". Cause: the same `en_US.UTF-8` collation sorts differently on Linux (glibc ignores punctuation) and macOS, so A–Z order depended on the server OS (Neon runs Linux). Fix: alphabetical sorts use `COLLATE "C"`. Local re-run passes; CI run on fb84a4c (Linux, -race): api, web and transcript jobs all succeeded.

## 2026-11-17 — day 3 (part 1): header, search, homepage, store

Automated:
- `npm test` (vitest): money formatting (8) + store URL state (6: round-trip of every filter, default sorts, junk values ignored, API query always has sort/page_size, toggling resets page, euro→cent parsing) → 14 passed.
- `tsc -b`, `eslint .`, `stylelint` → pass. Disabled stylelint `no-descending-specificity` (rule-order noise in CSS Modules).

Manual (browser, local dev servers):
- Homepage renders only what `/api/home` lists; each block loads separately (banners, category strip, 4 product rows).
- Header search, typo "hollow crwn": dropdown shows 5 Hollow Crown listings with prices; Enter → `/store?q=hollow%20crwn`, H1 "Results for “hollow crwn”", 5 results, top result Hollow Crown (PC) Steam GLOBAL.
- Visual review #1 (home, store; desktop + mobile): see `docs/design/visual-review.md` — 2 high, 2 medium issues found and fixed.

## 2026-11-17 — day 4 (part 1): product page, auth, cart

Automated (`go test -count=1 ./...`, all packages pass):
- app/auth (7 tests, full router + real DB): register → cookie (`sid`, HttpOnly, SameSite=Lax, Path=/) → `/me` → logout → `/me` 401 → replayed old token 401 → login issues a new token; bcrypt cost 12 stored, session stored as sha256(token); validation (bad e-mail ×2, short and 73-byte password → 422 with field); duplicate e-mail (case-insensitive) → 409; wrong password and unknown e-mail give identical 401 and no cookie; absolute and idle expiry → 401; cross-site POST → 403 `cross_origin`, same-origin and trusted dev origin allowed, cross-site GET allowed, form-encoded POST → 415; 6th login attempt for one e-mail → 429; prod cookie `__Host-sid` with Secure/HttpOnly/SameSite=Lax/Path=/ and no Domain; `Cache-Control: no-store`, `nosniff`.
- app/cart (6 tests): all cart endpoints 401 when signed out; PUT/GET/DELETE with totals; PUT sets exact quantity; price change shows immediately; quantity 0/-1/11 → 422; more than stock → 409 `insufficient_stock`; unknown/inactive offer → 404; sold-out → 409; carts isolated between users; merge sums quantities capped at 10 and skips unknown offers; guest lookup keeps order/quantities, rejects malformed input, contains no key codes.
- web (vitest, 19 tests): + guest cart (4: same offer increments, caps at stock and 10, stores only ids/quantities, remove/clamp) + `safeNext` open-redirect guard.

Manual (browser, local):
- Product page: featured offer = cheapest in-stock offer; "N offers" list with seller, rating, stock, price and per-offer buttons.
- Guest adds the **non-cheapest** offer (KeyHarbor) → cart shows KeyHarbor €42.79 → "Log in and checkout" → `/login?next=%2Fcheckout` → demo login → lands on `/checkout`; `/api/cart` now holds KeyHarbor ×1, browser cart emptied, header shows "Demo Buyer | Log out", `document.cookie` is empty (HttpOnly).
- Visual review #2 (product, login, cart): 1 high + 2 low fixed, see `docs/design/visual-review.md`.

## 2026-11-17 — day 5: orders, payment, key delivery, end-to-end

Automated — Go (`go test -count=1 ./...` all pass; `internal/orders` also `-race -count=10`, all 16 tests pass every run):
- orders service: create→pay delivers distinct `DEMO-` keys equal to quantity, keys hidden before payment, other user gets 404, list has no keys; paying removes bought offers from the cart; bad input (no key, empty, qty 0/11, duplicate line, unknown offer, wrong total) leaves no order and no reserved keys; price change → 409 then retry with new total works; inactive offer → 409; multi-line order with one short line reserves nothing; **fault injection** after reservation → no order, no items, no reserved keys, then the same request succeeds; idempotent create (same key → same order, different cart → 422); **10 concurrent identical creates → 1 order**; decline keeps reservation, replayed attempt key returns its first result, retry succeeds, double pay → one payment; **8 concurrent pay submissions → 1 successful payment**; expired order can't be paid and returns keys; sweep frees stock for another buyer; new checkout cancels the previous pending order; cancel is idempotent and refused for paid orders; intruder pay/cancel/get → 404; **50 buyers racing for 3 keys → exactly 3 winners, 47 out_of_stock, 3 distinct orders**; **mixed stress** (12 workers × 25 steps of create/pay/decline/cancel/expire+sweep on 45 shared keys) → no deadlock (40P01/40001), invariant holds, no key lost or created.
  - Bugs found by the tests: (1) a test helper used `$1` for a citext and a text column (SQLSTATE 42P08) — fixed in the helper; (2) the stress test first passed while creating **0 orders**: `offerIDs[i], prices[offerIDs[i]] = …` evaluates the map index before assignment, so every total was wrong. Fixed, and the test now fails unless paid, cancelled, expired, declined and out-of-stock paths all occurred.
- HTTP (app package): 401 signed out, 422 empty cart, 400 without Idempotency-Key, 201 then 200 for a retried create, 402 on decline, 422 on invalid outcome, no `DEMO-` in unpaid order JSON, 200 + key on pay, history without keys, detail with the same key, other account → 404 on detail/pay/cancel and empty history, 409 cancel of a paid order, cross-site order creation → 403.

Automated — Playwright (`cd e2e && npx playwright test`, local dev servers): 7 passed.
- Homepage → first card → **most expensive in-stock offer** (proves the chosen seller is kept) → cart (guest) → "Log in and checkout" → `/login?next=/checkout` → create account → checkout → demo **decline** → demo **success** → order page shows the product, `Seller: <chosen seller>` and a `DEMO-XXXXX-XXXXX-XXXXX` key → order history row "Paid" → opening it shows the same key → cart empty.
- Header search with typo "starfal odysey" → suggestion shows Starfall Odyssey → results page → product → same purchase flow.
- `/checkout` and `/account/orders` redirect to login; `GET /api/orders` → 401.
- Store: Steam checkbox → URL `platform=steam`, count equals API total; sort → URL; back button restores.
- Mobile (Pixel 7): menu, header search, two cards per row, no horizontal overflow.
- Design tokens: page `rgb(70,24,172)`, Metropolis, card panel `rgb(31,10,77)`, radius 0, header rows 97/50px, nav `rgba(0,0,0,.25)`, Buy now `rgb(250,211,24)` on black.
- Homepage from DB: renaming/moving the deals section and disabling "upcoming" in `home_sections` changes the rendered page (local only).
- First run: 4 of 7 failed, all test-side timing/selector issues (read page before client-side navigation finished; checked a URL-controlled checkbox synchronously; `name: 'Categories'` also matched "Browse categories"; filled the login form during the switch to the register form). Fixed in the tests; the two journeys then passed 3 more consecutive times.
- Note: the per-IP registration limit (10/min) can be hit by many rapid local E2E runs.

Manual (browser): demo account checkout of the KeyHarbor offer → payment page with 15:00 countdown → decline shows message, keys stay reserved → success → `/orders/<id>` shows key `DEMO-DJKEV-…`, cart badge 0 → "My orders" lists it as Paid.

## 2026-11-17 — optional Eneba catalog switch

- Scraper run once (`node e2e/tools/scrape-eneba.mjs --limit=36`): 2 listing pages + 36 product pages, 3 s apart, images/fonts not downloaded; 31 products saved, 5 skipped (no structured product data). Snapshot check: every product has 4–5 offer prices, all ≤ list price.
- `go run ./cmd/import-eneba` twice: 31 products / 149 offers / 1840 keys, then 0 new keys (idempotent).
- Go test `TestCatalogSwitchIsolatesProducts`: default and malformed `X-Catalog` → demo catalog only; `X-Catalog: eneba` → snapshot products only; demo search doesn't find snapshot products; `/api/catalogs` lists both; responses carry `Vary: X-Catalog`.
- Manual (browser): switch appears only when a snapshot is imported; on → banner "Showing a snapshot of eneba.com listings from 2026-11-17 …", homepage rows show real titles/covers/prices (e.g. Minecraft Java & Bedrock €15.30); off → our catalog returns, banner hidden. First attempt kept stale rows on screen (`removeQueries` doesn't refetch mounted queries) → switched to `resetQueries`.
- Full suites after the change: Go all packages pass; vitest 19 passed; Playwright 7 passed (tests run with the switch off).

## 2026-11-17 — CI with Playwright

- GitHub Actions run on f53bb06 (Linux): api (gofmt, vet, `go test -race`), web (typecheck, lint, stylelint, vitest, build), e2e (fresh Postgres → seed → API + Vite → all Playwright tests incl. the database-driven homepage test) and transcript link check — all succeeded.

## 2026-11-17 — production (https://keyshop.zenkiux.com)

- `BASE_URL=https://keyshop.zenkiux.com E2E_DATABASE_URL=postgres:///keyshop_prod npx playwright test` → **7 passed** (both purchase journeys, sign-in redirects, store URL state, mobile, design tokens, homepage driven by the production database).
- Through the real Cloudflare path: register sets `__Host-sid=…; Path=/; HttpOnly; Secure; SameSite=Lax`; cross-site POST → 403; same-origin login with wrong password → 401; Eneba cover from `imgproxy.eneba.games` → 200; unknown hostname on the tunnel → 530 (not routed).
- Found: plain `http://` served the page (and login can't work there because the cookie is Secure-only). Fix: production redirects `X-Forwarded-Proto: http` to HTTPS (test added) → now `301 https://keyshop.zenkiux.com/store?q=a`.
- Server listens on 127.0.0.1 only: request to the Mac's LAN address on :8090 → connection refused.
- Go: `TestStaticSiteServesSPA` (SPA fallback, security/noindex headers, immutable asset caching, `/api/*` stays JSON 404, path traversal → index.html, HTTP→HTTPS redirect).
- Transcript verifier bug found while committing: 3 tool results containing `\r\n` (from `curl -I` headers) were reported as mismatches because the verifier read the Markdown with Python's universal-newline translation. The export was correct. Fix: all transcript reads/writes are byte-exact (`newline=""`); verify passes on all blocks and the tamper test still fails as expected.

## 2026-11-17 — search upgrade, "Will it work for me?", languages and currencies

Automated:
- Go: `internal/search` (normalisation, acronyms, numerals, aliases: "Grand Theft Auto VI" ⇒ "gta vi", "gta 6", "gta6"; "Red Dead Redemption 2" ⇒ "rdr2"; "Call of Duty" ⇒ "cod"; "Counter-Strike 2" ⇒ "cs2"; leading "V" in "V Rising" stays a letter); `internal/compat` (GPU recognition from real WebGL renderer strings incl. Apple M2 Pro and Intel Iris Xe; Safari's generic "Apple GPU" not matched; Elden Ring requirements parsed; RTX 3060 PC passes, Iris Xe/8 GB fails on gpu+cpu+ram, Mac fails on OS; CPU ordering; region rules); catalog `TestWorksForMeFilter` (strong PC > budget PC > Mac; owning a PlayStation adds PSN keys; US buyer gets no Europe/UK keys; bad params → 400) and `TestProductRequirementsExposed`; new search cases ("kingdom forge ii", "tfv"); home `TestSectionTitlesFollowLanguage` (LT title, unsupported language → English).
  - First run of the works filter test failed because the test's "weak PC" was below even the indie minimum (only 3 platform-free items left) — the filter was right; the profile was changed to a realistic budget PC.
- Web (vitest, 32): verdict rules (6), store URL incl. "works" (7), i18n placeholders, i18n coverage (every `t('…')` key exists in lt/de/pl; a deleted key made it fail).
- Playwright (local, 15 passed): + compat (product panel reasons on a Mac, PSN key without a PlayStation, "Works for me" filter + chip + badges, setup page detect/save/matches/check-any-game, proposal notes + /proposal), search (numeral, acronym, typo; Eneba catalog "gta 6", "gta6", "GTA VI", "grand theft auto vi", "gta" → Grand Theft Auto VI).

Manual (browser): detection on this Mac recognised macOS and "Apple M3" from WebGL, estimated CPU from 8 threads, warned about the 8 GB browser memory cap; verdict list for "kingdom forge" explained each failure (OS, region, console). Lithuanian + USD: product page fully translated, €35.59 shown as 38,44 USD. Category bar overflow between 901–1100 px (reported by the translation sub-agent, pre-existing) fixed by horizontal scrolling.

## 2026-11-17 — expanded Eneba catalog, production check

- Scraper v2 (one clean run + a top-up for PlayStation/Nintendo page 3): 282 products in the snapshot, types from schema.org breadcrumbs, 70+ with official system requirements. Bug found during the first v2 run: types came from all `nav a` links (the header nav contains "Software"), so games were labelled software — switched to the page's `BreadcrumbList` JSON-LD. A stop signal didn't end the first run, so two runs wrote the same files; both were stopped (`pkill -9`), the snapshot's derived fields reset and a single clean run made.
- Import (local and production): 282 products, 1186 offers. Per tab with the Eneba catalog on (local = production): Games 128, DLC 49, Gift cards 41, Subscriptions 34, Software 30, Steam 76, Xbox 62, PlayStation 33, Nintendo 33 (page size 24). Added the missing "Software" nav tab.
- Playwright against https://keyshop.zenkiux.com: first run 14/15 — the product-page compatibility test failed because the production demo catalog was seeded before requirements existed (seed only runs on an empty DB). Re-applied the idempotent seed (`deploy.sh seed`, new) → **15/15 passed**.

## 2026-11-17 — checkout matched to eneba.com

- Reference: walked the real Eneba checkout signed in as the owner (cart and payment steps), measured layout and styles; nothing paid or confirmed (`docs/design/visual-review.md` review #4).
- Playwright first run after the redesign: both purchase journeys timed out on `radio.check()` — the visually hidden radio had `pointer-events: none`, so a pointer couldn't select it. Fixed in CSS (the invisible input now covers the whole row); 15/15 pass locally.
- i18n coverage test caught 15 new untranslated strings; translations added for LT/DE/PL.
- Production deploy incident: `deploy.sh` restarted the API with `launchctl bootout` + immediate `bootstrap`; bootout is asynchronous, bootstrap failed, and the API stayed down (the Playwright production run failed 15/15 within minutes, which is how it was noticed). Fix: wait until the old service is gone and retry bootstrap, fail loudly otherwise. Redeployed → **15/15 pass on https://keyshop.zenkiux.com**. Downtime: a few minutes.
- 2026-11-17 — "Will it work for me?" false positive reported by the owner (old PC "could run" GTA V). Root cause: unrecognised requirement text was skipped (treated as a pass) and CPU buckets were too coarse. Fix and regression tests: `TestOldPCAgainstGTAV`, `TestUnrecognisedRequirementIsUnchecked` (Go), `an old PC fails GTA V`, `never says "works" when a listed requirement could not be read` (Vitest), `an old PC is told it can’t run a game` (Playwright), and the catalog test now checks that unknown hardware is not a pass. Parser coverage on the 117 real requirement sets: 111 fully parsed, 6 marked "can't check".
- 2026-11-17 — Account area: Go tests `TestLoginHistoryAndRevokeOthers`, `TestChangePasswordAndName` (wrong current password 422, other sessions end, old password rejected), `TestWishlist` (per-user, idempotent, 404 on unknown product, 401 for guests); Playwright `account.spec.ts` (user menu → overview → sidebar → rename → password change → login history → keys library; favourites incl. guest redirect). Local: Go all packages ok, Vitest 35/35, Playwright 18/18.
- A formatter run with default settings briefly rewrote several files in a different code style; they were restored from git and the edits re-applied (no behaviour change).
- 2026-11-17 — Eneba parity (review #6). Go: `TestRecentlyViewedRecommendedAndGenres`, `TestGenreOSAndCountryFilters` (facet count = filtered total; country=US excludes Europe/UK keys), `TestReviewsOnlyFromBuyers` (403 before buying, 422 invalid, one review per user, rating feeds the product), `TestNewsletterAndTrending`. Playwright `parity.spec.ts` (homepage rows, store filters, card add-to-cart, product sections + buy-then-review, footer newsletter + Help anchor) and a search-box test (trending, phrases, "Show all N"). A failed template build used to leave an empty template DB that later runs reused (all order tests then failed with "no rows"); `testdb` now drops a half-built template.
