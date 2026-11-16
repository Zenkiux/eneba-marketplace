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
