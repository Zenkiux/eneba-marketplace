# Scope decisions

The PDF says specs are "intentionally vague" and that "a few features done extensively beat many fitting minimal requirements". We put the depth into the required purchase journey (catalog → search → offers → cart → checkout → payment → keys → order history) and left out everything that doesn't serve it.

## In scope (and how deep)

| Area | Depth |
|---|---|
| Catalog | Server-side filters (platform, region, type, price), 7 sort orders, pagination, facet counts, URL state, empty/error/loading states |
| Search | Typo- and partial-tolerant ranking with `pg_trgm`; header suggestions on every page; results page |
| Homepage | Fully backend-driven layout and content; one provider per block type; blocks fail independently |
| Product page | Multiple seller offers with ratings and stock; offer choice preserved to the order |
| Cart | Guest cart (browser) + server cart for signed-in users, merged at sign-in; stock/price changes surfaced at checkout |
| Checkout | Reservation with expiry, idempotent order creation and payment, concurrency-safe key allocation, cancel, retry after decline |
| Auth | Email + password, server sessions, cross-site request protection, rate limiting |
| Order history | Owner-only list and detail with decrypted keys for paid orders |
| Styling | Measured Eneba tokens; visual acceptance gate on desktop and mobile |

## Deliberately left out

| Feature | Why it's out |
|---|---|
| Real payment provider (Stripe test mode etc.) | PDF allows simulation; a provider adds accounts, webhooks and secrets without showing anything new about the purchase logic. Our simulated step still drives a real order/payment lifecycle. |
| Social login / magic links (Eneba uses magic links) | Needs external accounts or email delivery; email + password satisfies "create an account and sign in". |
| Email delivery of keys / receipts | Keys are delivered in the order page, which is what the diagram shows ("Order and key"). |
| Seller dashboard / listing management | Not in the PDF; sellers and offers are seeded. |
| Admin UI for the homepage | Homepage content lives in the database (that *is* its backend source); editing rows changes the page. A UI would be extra surface without new requirements. |
| Wishlist, reviews, cashback, giveaways, gift cards, top-ups | Visible on Eneba but not required; icons kept for visual fidelity only where harmless (wishlist icon is decorative / disabled). |
| Multiple currencies and languages | One currency (EUR) and English; the header shows the fixed "English EU \| EUR" like Eneba. |
| Recommendations ("Recommended for you", "Gamers also viewed") | Would need user behaviour data; "Best sellers" and "Deals" cover the required block types. |
| Refunds / order cancellation after payment | Not required; cancel exists only for unpaid orders. |
| Microservices | A modular monolith with one provider per homepage block meets "its own backend service or database" without extra deployables. |
| Real game titles and cover art | No rights to the artwork; fictional catalog with our own covers instead. |

## Revisit if time remains (in this order)

1. Cart page reference check against the real Eneba cart (needs an item in Eneba's cart, no purchase).
2. "Load more offers" and seller detail tooltips.
3. Mobile filter drawer polish.
