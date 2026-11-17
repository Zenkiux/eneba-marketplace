# Visual review log

Process: `docs/testing-plan.md` → "Visual acceptance". Reference shots (eneba.com) are in `design/reference/` (local only); ours are in [`app/`](app/). Captured with `node e2e/visual/capture.mjs reference|app` at 1280×800 and 375×812, then compared by eye side by side.

Gate: a screen is accepted when it has no open **high** differences at both widths.

## Review #1 — 2026-11-17 (home, store)

Measured on eneba.com for this review (added to `tokens.css`): category nav `rgba(0,0,0,.25)`, filter panel `#5825CC`, active-filter chips `#2C0E6C` with 15px radius, filter checkboxes 2px `rgba(255,255,255,.7)` border with 3px radius, price inputs `rgba(0,0,0,.2)` 40px tall, platform strip on covers `rgba(0,0,0,.55)`, breadcrumbs 14px `rgba(255,255,255,.7)`, store H1 30px/700, "Clear all" in CTA yellow, region colours pink (Global) and teal `#23C299` (Europe).

| ID | Screen | Viewport | Difference vs Eneba | Severity | Fix | Status |
|---|---|---|---|---|---|---|
| V1 | Store | desktop | Mobile-only "Filters" button visible above results (CSS rule order) | high | Hide by default, show only ≤900px | fixed |
| V2 | Store | desktop | Max-price input truncated ("Ma:") by an OK button; Eneba has two plain inputs | medium | Apply on Enter/blur; submit button visually hidden | fixed |
| V3 | Home, store | both | Platform strip on covers hides the studio line of our generated art | medium | Re-rendered covers with text raised above the strip | fixed |
| V4 | Home | mobile | Main banner cropped through its headline at 375px | high | Shorter hero (190px) and banner art anchored left on mobile | fixed |
| V5 | Home | desktop | Eneba's hero has a countdown promo widget overlapping the banner | low | Not reproduced (promotional extra, not required) | won't fix |
| V6 | Home | both | Eneba shows "Recommended for you" (personalised) | low | Not reproduced; we show data-driven "Top games" (see scope-decisions.md) | won't fix |
| V7 | Home | mobile | Category strip shows 3 items before scrolling; Eneba shows 3½ | low | — | open |
| V8 | Store | mobile | On ~150px-wide cards the studio line still touches the platform strip | low | — | open |

Result: home and store accepted (no open high items).

Screenshots after fixes: [home desktop](app/home-desktop.png), [home mobile](app/home-mobile.png), [store desktop](app/store-desktop.png), [store mobile](app/store-mobile.png).

## Review #2 — 2026-11-17 (product, login, cart)

| ID | Screen | Viewport | Difference vs Eneba | Severity | Fix | Status |
|---|---|---|---|---|---|---|
| V9 | Product | mobile | Price box and buy buttons came after the long fact list (needed scrolling to buy) | high | Featured offer moved above the facts on narrow screens | fixed |
| V10 | Login | desktop | Greeting smaller than Eneba's (≈80px) and broken in different places | low | 8rem, line breaks after "Hi!" like Eneba | fixed |
| V11 | Login | desktop | Demo credentials rendered in a monospace font | low | Use the site font | fixed |
| V12 | Login | both | Eneba's login page has no site header (separate my.eneba.com domain) and offers social/magic-link sign-in | low | Kept our header for consistent navigation; e-mail + password only (scope-decisions.md) | won't fix |
| V13 | Product | desktop | Eneba shows Trustpilot score, video/screenshot gallery, reviews and system requirements | low | Out of scope; product details + offers comparison implemented | won't fix |
| V14 | Cart | both | No Eneba reference captured (cart needs items; not inspected) | — | Built from measured components (offer-row background, featured-offer panel, yellow CTA) | noted |

Result: product, login and cart accepted (no open high items). Screenshots: [product desktop](app/product-desktop.png), [product mobile](app/product-mobile.png), [login desktop](app/login-desktop.png), [login mobile](app/login-mobile.png).

## Review #3 — 2026-11-17 (cart, checkout, payment, order, history, 404)

Captured with `node e2e/visual/capture-flow.mjs` (signs up a throwaway account, buys two offers, screenshots each step at 1280 and 375). No Eneba references exist for these screens (account + purchase needed); they were checked against the measured component language and the rest of our app.

| ID | Screen | Viewport | Difference / issue | Severity | Fix | Status |
|---|---|---|---|---|---|---|
| V15 | Checkout, payment, order | mobile | Step indicator wrapped onto two lines | medium | Numbers only for other steps; label for the current step | fixed |
| V16 | Order | mobile | Key code broke across lines (hard to read/copy) | medium | Smaller, non-wrapping key text on narrow screens | fixed |
| V17 | 404 | both | Eneba: "Highscore! 404" with playful ghosts and an outlined button | — | Same structure with our own copy ("Level not found! 404") and original pixel sprites | matches |
| V18 | Order history | desktop | Long multi-item titles joined on one line | low | — | open |

Result: all flow screens accepted (no open high items). Screenshots: `app/{cart,checkout,payment,order,orders,notfound}-{desktop,mobile}.png`.
