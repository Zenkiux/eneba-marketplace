# Eneba design reference

Measured on https://www.eneba.com/ on 2026-11-17 with the in-app browser: computed styles read with `getComputedStyle`, screenshots at about 1024 px (desktop) and 375×812 (mobile). Only values that were actually measured are listed as measured; anything else is marked as an estimate. No purchases were made, no login was attempted and no consent was given beyond what viewing needs.

## Colours (measured)

| Token | Value | Where it appears |
|---|---|---|
| `--bg-page` | `#4618AC` (rgb 70, 24, 172) | `body` background on every page |
| `--bg-panel` | `#1F0A4D` (rgb 31, 10, 77) | Product-card info panel; login page background |
| `--bg-row` | `rgba(0,0,0,.3)` | Seller offer rows on the product page |
| `--cta` | `#FAD318` (rgb 250, 211, 24) | "Add to cart", "Buy now", "Register" buttons; black text |
| `--text` | `#FFFFFF` | Default text |
| `--text-soft` | `rgba(255,255,255,.85)` | Platform tag on cards |
| `--text-muted` | `#B3AAC9` | "From" label above prices |
| `--region` | `#E76A8C` | Region name on cards ("Europe", "Global") |
| `--positive` | `#84E916` | Discount percentage, cashback |
| `--border-search` | 1px solid `#FFFFFF` | Header search box |

## Typography (measured)

- Family: `metropolis, Arial, Helvetica, sans-serif`; weights loaded 400, 600, 800 (plus a monospace variant). Metropolis is an open-source font (SIL Open Font License); the licence is checked again before we self-host it.
- Root font size 10px; body 16px / 24px.

| Element | Size / weight / line height |
|---|---|
| Section heading (H2, e.g. "Top games") | 30px / 700 / 37.5px |
| Product page title (H1) | 26px / 700 |
| Card title | 12px / 800, two lines |
| Card price | 22px / 800 |
| Card meta (region, "From") | 12px / 800 |
| Platform tag | 10px / 800 |
| Buttons | 15px / 800 |
| Category nav links | 14px / 600 |
| Header search input | ~18.6px / 800, 40px left padding for the icon |
| Seller name in offers | 14px / 600 |

## Shape, borders, shadows (measured)

- `border-radius: 0` on buttons, cards, panels and inputs. Square corners are a defining trait.
- No box shadows on cards or buttons.
- Promo pill in the nav ("GTA 6") is the one rounded/highlighted item (estimate: small radius, pink-red fill).

## Layout (measured)

- Content max width 1240px, side padding 20px.
- Header: 147px tall on desktop, made of a 57px top row and a 50px category nav.
  - Top row: logo (left) · search box 379×57 with white 1px border · language/currency ("English EU | EUR") · wishlist icon · cart icon · user icon with "Log in | Register".
  - Category nav: hamburger + "Categories", then text links (Cheap Games, Software, eGift Cards, …) and a highlighted promo pill.
- Mobile (375px): hamburger, logo, then search / wishlist / cart / user icons; the search box collapses to an icon.

## Homepage (observed)

Order of blocks: hero (large banner carousel with countdown promo + three promo tiles on the right) → category icon strip (Games, Gaming eCards, eGift Cards, E-money, Steam…) → product rows with H2 titles: "Popular gift cards", "Recommended for you", "Top games", "Best selling eGift Cards", "Upcoming games", "Categories". Rows show 4–5 cards on desktop and scroll sideways on mobile.

## Product card (measured)

- 225px wide in a row; cover image 2:3 (225×315) with no rounding.
- Info panel background `#1F0A4D`, padding `0 15px 15px`, total card height about 460px.
- Content top to bottom: platform tag · title (2 lines) · region in pink · "From" (muted) · price 22/800 · old price struck through and green "-49%" when discounted · cashback line in green.
- On hover: yellow "Add to cart" button (35px tall) and "View offers".

## Store / catalog (observed at /store/games)

- Breadcrumbs, then H1 ("Buy the best video game keys at the best price!").
- Left filter column 220px: Price range (EUR, min/max inputs) · Country · Type (checkboxes with counts) · Operating system · Platforms (with counts). Filter panel uses the page background.
- Above results: chips for active filters ("Type (1)", "Regions") + "Clear all"; "Results found: 10000+"; sort dropdown.
- Sort options: Price: Low to High · Price: High to Low · Date: Newest First · Date: Oldest First · Popularity: Most popular · Alphabet: A–Z · Alphabet: Z–A · Discounts.
- Grid of cards, 4 per row at 1024px.

## Product page (observed)

- Breadcrumbs → cover (left) → H1 title, wishlist heart, "N people watching".
- Feature list with icons: region ("Global — can be activated in …"), platform ("Steam Gift — check activation guide"), "Digital key", "Instant delivery", refunds note; "Works on: Windows, Mac, Linux".
- Right column: featured offer box: old price, green -%, big price, note, yellow **Buy now**, "+7 offers from €8.93".
- "Recommended offers" and "N other offers" lists: each row on `rgba(0,0,0,.3)` with 20px padding: seller name (14/600), rating "9.68 Excellent rating", old price, -%, price, yellow **Buy now** (35px tall). "Load 4 more offers" button.
- Further down: "Gamers also viewed", reviews, product details, system requirements, other details.

## Other screens

- **404:** big "Highscore! 404", one line of copy, outlined "Continue browsing" button, playful ghost illustrations.
- **Login** (my.eneba.com/login): full-bleed dark purple; huge greeting "Hi! It's nice to see you!" on the left; on the right a purple form panel with social buttons, email field and yellow full-width submit. Eneba uses magic links; we use email + password.
- **Not inspected:** cart, checkout, payment, order pages. The cart icon did nothing with an empty cart and checkout needs an account and items. These screens are built from the measured component language; to be revisited by adding an item to the Eneba cart without paying.

## Rules for our implementation

1. All colours, sizes and spacings come from `web/src/styles/tokens.css`; no raw hex values elsewhere (stylelint enforced).
2. Corners are square (`border-radius: 0`) except the promo pill.
3. Yellow is reserved for the primary action on a screen.
4. Prices always use the card price style; discounts are green; regions are pink.
5. Cards are 2:3 covers with the dark info panel — never rounded white cards.
6. No generic gradients, drop shadows or dashboard styling.

## Visual acceptance process

See `testing-plan.md` → "Visual acceptance". Reference screenshots live in `design/reference/` (local only, not committed, because they contain third-party artwork); our screenshots and the review log are in `docs/design/`.
