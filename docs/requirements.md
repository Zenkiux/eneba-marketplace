# Requirement traceability matrix

Source: `Eneba Internship Assignment.pdf` (2 pages), read in full on 2026-11-17.
Received 2026-11-16 16:48 EET; latest submission by our calculation 2026-11-23 16:48 EET (Eneba's reading of the deadline wins if it differs).

**Type:** E = explicit in the PDF, I = our interpretation of an explicit item, R = engineering recommendation, O = optional.
**Status values:** planned, in progress, done (evidence linked), verified on production.

## Page 1: process and AI

| ID | PDF text (quoted) | Type | Interpretation | Implementation | Acceptance | Verification | Status |
|---|---|---|---|---|---|---|---|
| R0 | "complete this homework assignment within 7 days after getting the assignment. Please reply to the registration email with your results" | E | Results = D1–D3 | Schedule in `implementation-plan.md`; email draft in `docs/submission.md` | Email with D1–D3 sent before the deadline | User sends it; every link checked first | planned |
| R1 | "Ask your agent to save a log of your conversations (full) which are required to submit." | E | Every Claude Code session, all prompts and replies, no summaries | `scripts/transcripts/transcripts.py` (export, verify), Stop hook, private raw backups | `verify --final` passes; all sessions listed | Hash-level integrity check, tamper tests, manual read-through | in progress (works on session 1) |
| R1b | "In case you use a non-agentic approach, please provide a link to the conversation." | E | The ChatGPT planning chat was non-agentic, so it gets linked | Link in transcript header, README, `agent-logging-plan.md` | Link opens without login | Private-window check | planned (link pending from user) |
| R2 | "We want to understand how you use AI." | E | Show the real workflow | README section "How AI was used", `decisions.md`, unedited transcript | A reviewer can follow prompt → decision → commit | Read-through before submission | planned |
| R3 | "You must be able to explain your code." | E | Code stays small and explicit | `interview-preparation.md`; no framework magic | Owner can walk through every main code path | Walkthrough on day 6 | planned |
| R4 | "Shortcuts are allowed, specs are intentionally vague … you decide the scope and you will have to justify it." | E | Each omission needs a written reason | `scope-decisions.md` | Every left-out feature has a reason | Review | planned |
| R5 | "implement a marketplace web application in Eneba's style that matches eneba.com website" | E | Recognisably Eneba-like on every screen | Design system from `eneba-design-reference.md` | Visual gate passes (no open high-severity differences) | Side-by-side screenshots, desktop and mobile | planned |

## Page 1: functional parts

| ID | PDF text (quoted) | Type | Interpretation | Implementation | Acceptance | Verification | Status |
|---|---|---|---|---|---|---|---|
| R6 | Store: "browse every product in the marketplace … narrow the list with filters (for example platform, region or price), change the order, and search by name." | E | All products in our DB, paginated, no cap. Filters: platform, region, product type, price range (lowest active offer). Sorts: popular, price up/down, newest, oldest, A–Z, Z–A, discount | `/store` page; `GET /api/products` with server-side filtering, sorting, paging and facet counts; state kept in the URL | Totals equal the DB count for every filter combination; sort order is stable | Go integration tests; Playwright filter/sort test | planned |
| R7 | Homepage: "assembled from several different blocks, such as a banner, best sellers or deals. Each block gets its content from its own backend service or database, so the frontend only displays what it receives and nothing is hardcoded there." | E | Block list and every block's content come from the backend; the frontend only maps block type to a component | `home_sections` table plus one provider per block (banners, best sellers, deals, new releases); `GET /api/home` and `GET /api/home/sections/{key}` | Changing DB rows changes the page with no frontend change | Go test and Playwright test that edit the DB and check the output | planned |
| R8 | Search: "search for products by name from anywhere in the app and see the matching results. Search should cope with typos and partial names where it can." | E | Search box in the header of every page; results page; partial and typo-tolerant matching | `pg_trgm` ranking (exact, prefix, substring, trigram similarity); suggestion dropdown; `/store?q=` | Partial names and one- or two-letter typos find the product | Test matrix: exact, partial, typo, casing, empty, no match, special characters, too long | planned |
| R9 | Product page: "showing its details and the offers from several sellers, so a buyer can compare and choose." | E | Several offers per product with seller, rating, price and stock; the chosen offer is the one bought | `/p/:slug`; `offer_id` kept through cart, order and history | Buying a non-cheapest offer records that exact seller and price | Playwright | planned |
| R10 | Checkout: "put products in a cart, pay, and receive the digital key they bought. Payment can be simulated or use a payment provider's test mode. No real money is involved." | E | Real order and key-allocation lifecycle; payment is a clearly labelled simulation | Cart → order with reserved keys → demo payment (success or decline) → paid order shows keys | Keys never sold twice; no keys left reserved by dead orders; retries are safe | Concurrency, idempotency, fault-injection and invariant tests; Playwright | planned |
| R11 | Authentication: "create an account and sign in. Some parts of the app, such as checkout and order history, are only for signed-in users." | E | Email and password accounts; server-side protection | Server sessions in an HttpOnly cookie; protected API routes; route guards in the app | Signed-out users get 401; other users' orders return 404 | Go security tests; Playwright redirect-and-return test | planned |
| R12 | Eneba styling: "Colors, typography, spacing and components follow the design reference." | E | Measured tokens and components | `tokens.css` and components from `eneba-design-reference.md` | Visual gate plus automated style assertions | Screenshot review; `style.spec.ts` | planned |
| R13 | Diagram: "A purchase starts from the homepage or from search": Homepage / Search → Product page → Cart → Checkout ("sign-in required") → Payment → Order and key; "Eneba styling applies to every screen" | E | Exactly these screens in this order | Routes `/`, `/store?q=`, `/p/:slug`, `/cart`, `/checkout`, `/checkout/:id/pay`, `/orders/:id` | Full journey works from both entry points, locally and on production | Main Playwright journey run with `BASE_URL` set to production | planned |

## Page 2: technical requirements

| ID | PDF text (quoted) | Type | Implementation | Verification | Status |
|---|---|---|---|---|---|
| T1 | "React for frontend (TypeScript preferred)" | E | React 19, strict TypeScript, Vite | `tsc --noEmit` in CI | planned |
| T2 | "Backend in PHP (or Go), REST or GraphQL" | E | Go REST API | Code review | planned |
| T3 | "Any database, decide on the data you need yourself" | E | PostgreSQL with versioned migrations | Migrations run in CI and on deploy | planned |
| T4 | "Architecture, data model and scope are yours to decide. A few features done extensively beat many fitting minimal requirements" | E | Modular monolith; depth goes into the purchase flow | `architecture.md`, `scope-decisions.md` | planned |

## Page 2: deliverables ("no evaluation without the following")

| ID | PDF text (quoted) | Implementation | Verification | Status |
|---|---|---|---|---|
| D1 | "Github link(s) to the project" | Public GitHub repository | Opened while logged out | planned |
| D2 | "Public URL where the app is deployed on a free-tier service (for example Render or Vercel)" | Vercel (frontend), Render (Go API), Neon (Postgres) | Full journey in a clean browser and Playwright against production | planned |
| D3 | "Agent chat history (full, both prompts and responses) in a md file or a link to AI chat" | `docs/agent-chat-history.md` with linked result files, plus the ChatGPT link | `transcripts.py verify --final` and a manual read | in progress |

## Ambiguities and how we decided

| Topic | Decision | Why |
|---|---|---|
| "browse every product" | Every product in our database, paginated | A real catalogue needs paging; nothing is capped or hidden |
| Which filters | Platform, region, product type, price range | The PDF's examples plus the type filter Eneba shows |
| What "price" means for a product | Lowest active offer price | Matches Eneba's "From €x" on cards |
| Payment form | Labelled demo step with success and decline buttons, no card fields | The PDF allows simulation; collecting card-like data adds nothing |
| Guest cart | Allowed; checkout needs sign-in | Matches the diagram (sign-in required at checkout) |
| Logo and branding | Our own wordmark and a "not affiliated with Eneba" footer | Style should match, but a public site must not impersonate Eneba |
| Product art | Fictional titles with our own covers built from openly licensed photos | No rights to real game art |
