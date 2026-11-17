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
