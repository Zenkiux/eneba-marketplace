# Implementation plan

Received 2026-11-16 16:48 EET. Latest submission 2026-11-23 16:48 EET. Target: submit on 11-23 before 12:00 EET.

| Day | Date | Milestone | Done when |
|---|---|---|---|
| 1 | Mon 11-17 | Transcript pipeline; 8 planning docs; git + public GitHub repo; skeleton `web/` and `api/`; migrations; seed; cover-art pipeline | `transcripts.py verify` OK; app skeleton runs locally; seed loads |
| 2 | Tue 11-18 | Catalog, search and homepage APIs with tests; **first production deploy** (Vercel + Render + Neon) incl. cookie / cross-origin check through the proxy | Prod URL serves data from Neon; tests green |
| 3 | Wed 11-19 | Design system, header with global search, footer, homepage, store page; visual review #1 | Home and store pass the visual gate on desktop and mobile |
| 4 | Thu 11-20 | Product page with offers; auth (API + pages); cart (guest, server, merge); visual review #2 | Can register, sign in and fill a cart on prod |
| 5 | Fri 11-21 | Orders, reservation, demo payment, keys, cancel, sweep; all checkout tests; order history; full E2E locally and on prod — **feature freeze** | Main Playwright journey green against production |
| 6 | Sat 11-22 | Visual review #3 and fixes; mobile polish; README, decisions, interview prep; independent requirement audit with evidence; `verify --final` | Every row in `requirements.md` has evidence |
| 7 | Sun 11-23 (morning) | Clean-browser production smoke test; final transcript export + verify; push; you send the email | Email sent with D1–D3 |

## Order of work inside each milestone

Implement → typecheck/lint → tests → fix root causes → record results in `docs/testing.md` → note decisions in `docs/decisions.md` → commit.

## Cut list if behind schedule (cut from the top)

1. "Load more offers" pagination on the product page.
2. Mobile filter drawer animation (keep a plain full-screen panel).
3. Hero carousel autoplay (keep manual arrows).
Never cut: anything in the purchase diagram, backend-driven homepage, typo search, deployment, transcript.
