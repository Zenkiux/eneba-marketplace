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
