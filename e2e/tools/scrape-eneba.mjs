// One-off, polite snapshot of eneba.com product listings for the optional "Eneba catalog" switch.
//   node tools/scrape-eneba.mjs [--per-source=24]   ->  data/eneba-snapshot.json (gitignored)
//
// Rules this script follows:
// - only store listing pages (/store/...) and product pages, both allowed by eneba.com/robots.txt
//   (never /search, /checkout, /payment or account pages);
// - one page at a time with a 3-second pause between requests; run by hand, not on a schedule;
// - images, media and fonts are not downloaded (the app links to Eneba's image CDN);
// - stores titles, cover URLs, prices, type, platform, region and system requirements only
//   (no descriptions or reviews);
// - merges with an existing snapshot, so products already captured are not fetched again.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, 'data/eneba-snapshot.json')
const perSource = Number(process.argv.find((a) => a.startsWith('--per-source='))?.split('=')[1] ?? 24)
// --details: only visit products already in the snapshot that have no `details` yet (genres,
// languages, publisher, developers, works-on, rating) — no listing pages.
const detailsOnly = process.argv.includes('--details')
const PAUSE_MS = Number(process.argv.find((a) => a.startsWith('--pause='))?.split('=')[1] ?? 3000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const B = 'https://www.eneba.com/store'

// Listing pages to collect product links from. `type` is the fallback when the breadcrumb is unclear.
const SOURCES = [
  { name: 'games', type: 'game', urls: [`${B}/games`, `${B}/games?page=2`] },
  { name: 'steam', type: 'game', urls: [`${B}/steam-games`] },
  { name: 'xbox', type: 'game', urls: [`${B}/xbox`, `${B}/xbox?page=2`] },
  { name: 'psn', type: 'game', urls: [`${B}/psn`, `${B}/psn?page=2`, `${B}/psn?page=3`] },
  { name: 'nintendo', type: 'game', urls: [`${B}/nintendo`, `${B}/nintendo?page=2`, `${B}/nintendo?page=3`] },
  { name: 'us-region', type: 'game', urls: [`${B}/games?regions[]=united_states&types[]=game`] },
  { name: 'uk-region', type: 'game', urls: [`${B}/games?regions[]=united_kingdom&types[]=game`] },
  { name: 'eu-region', type: 'game', urls: [`${B}/games?regions[]=europe&types[]=game`] },
  { name: 'dlc', type: 'dlc', urls: [`${B}/all?types[]=dlc`, `${B}/all?types[]=dlc&page=2`] },
  { name: 'software', type: 'software', urls: [`${B}/all?types[]=software`, `${B}/all?types[]=software&page=2`] },
  { name: 'subscription', type: 'subscription', urls: [`${B}/all?types[]=subscription`, `${B}/all?types[]=subscription&page=2`] },
  { name: 'gift-cards', type: 'gift-card', urls: [`${B}/gift-cards`, `${B}/gift-cards?page=2`] },
]

// Slug prefix → platform. Eneba product slugs start with the activation platform.
const PLATFORMS = [
  ['steam', 'steam'], ['xbox', 'xbox'], ['psn', 'psn'], ['nintendo', 'nintendo'], ['gog', 'gog'], ['epic', 'epic'],
  ['ea', 'ea'], ['origin', 'ea'], ['ubisoft', 'ubisoft'], ['uplay', 'ubisoft'], ['rockstar', 'rockstar'],
  ['battle-net', 'battlenet'], ['riot', 'other'], ['windows-store', 'microsoft'], ['microsoft', 'microsoft'], ['other', 'other'],
]
// Slug suffix → region (longest first).
const REGIONS = [
  ['north-america', 'north-america'], ['united-states', 'north-america'], ['usa', 'north-america'], ['canada', 'north-america'],
  ['united-kingdom', 'united-kingdom'], ['latin-america', 'latin-america'], ['latam', 'latin-america'],
  ['europe', 'europe'], ['emea', 'europe'], ['turkey', 'turkey'], ['argentina', 'argentina'], ['brazil', 'brazil'],
  ['row', 'rest-of-world'], ['global', 'global'],
]
const platformOf = (slug) => PLATFORMS.find(([p]) => slug.startsWith(p + '-'))?.[1] ?? 'other'
const regionOf = (slug) => REGIONS.find(([r]) => slug.endsWith('-' + r))?.[1] ?? 'global'

function typeFromCrumbs(crumbs, fallback) {
  const t = crumbs.join(' / ').toLowerCase()
  if (/\bdlc/.test(t)) return 'dlc'
  if (/software/.test(t)) return 'software'
  if (/subscription|game pass|ps plus|membership/.test(t)) return 'subscription'
  if (/gift card|ecard|game points|wallet|top-up/.test(t)) return 'gift-card'
  if (/\bgames\b/.test(t)) return 'game'
  return fallback
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { products: [] }
const known = new Map(previous.products.map((p) => [p.slug, p]))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.route('**/*', (route) =>
  ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
)

async function listingSlugs(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const hrefs = await page.$$eval('main a[href]', (as) => as.map((a) => a.getAttribute('href')))
  await sleep(PAUSE_MS)
  return [...new Set(hrefs.filter((h) => /^\/[a-z0-9-]+$/.test(h) && h.split('-').length > 3).map((h) => h.slice(1)))]
}

async function product(slug, fallbackType) {
  await page.goto(`https://www.eneba.com/${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2000)
  // Lower sections (genres, "Other details") render only once scrolled into view.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 800) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 150))
    }
  })
  await page.waitForTimeout(500)
  const data = await page.evaluate(() => {
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent) } catch { return null } })
      .find((x) => x && x['@type'] === 'Product')
    const prices = [...document.querySelectorAll('main span')]
      .filter((e) => e.children.length === 0 && /^€\d+(\.\d\d)?$/.test(e.textContent.trim()))
      .map((e) => Math.round(Number(e.textContent.trim().slice(1)) * 100))
    // Category path from the page's schema.org BreadcrumbList, e.g. Store › Categories › Games › Steam Games
    // (excluding the product name itself). The visible header nav also says "Software", so it can't be used.
    const bl = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent) } catch { return null } })
      .find((x) => x && x['@type'] === 'BreadcrumbList')
    const crumbs = (bl?.itemListElement ?? []).map((i) => i.name ?? i.item?.name ?? '').slice(1, -1)
    // System requirements: "Minimum…" / "Recommended…" headings followed by "Key<TAB>Value" items.
    const req = {}
    const h = [...document.querySelectorAll('h2')].find((e) => /system requirements/i.test(e.textContent))
    if (h) {
      let box = h.parentElement
      for (let i = 0; i < 3 && box && box.innerText.length < 80; i++) box = box.parentElement
      let level = null
      for (const el of box.querySelectorAll('h3, li')) {
        const text = el.innerText.trim()
        if (el.tagName === 'H3') level = /recommended/i.test(text) ? 'recommended' : /minimum/i.test(text) ? 'minimum' : level
        else if (level && text.includes('\t')) {
          const [k, ...v] = text.split('\t')
          ;(req[level] ??= {})[k.trim()] = v.join(' ').replace(/\n+/g, ' | ').trim()
        }
      }
    }
    // "Other details" label/value rows and the genre tags under "Product Details".
    const details = {}
    for (const l of ['Languages', 'Release date', 'Publisher', 'Developers', 'Works on']) {
      const el = [...document.querySelectorAll('main *')].find((e) => e.children.length === 0 && e.innerText?.trim() === l && !e.closest('a,button'))
      if (!el) continue
      let row = el.parentElement
      let val = row.innerText.replace(l, '').trim()
      for (let i = 0; i < 2 && !val; i++) {
        row = row.parentElement
        val = row.innerText.replace(l, '').trim()
      }
      details[l] = val.split(/\n+/).map((v) => v.trim()).filter(Boolean)
    }
    // Genre tags under "Product Details" link to /store/<genre>-games?…itm_medium=genre.
    const genres = [...new Set([...document.querySelectorAll('a[href*="itm_medium=genre"]')].map((a) => a.innerText.trim()))]
      .filter((v) => v && v.length < 40)
      .slice(0, 12)
    const rating = ld?.aggregateRating ? { value: Number(ld.aggregateRating.ratingValue), count: Number(ld.aggregateRating.ratingCount) } : null
    const extra = { genres, languages: details['Languages'] ?? [], publisher: details['Publisher']?.[0] ?? '', developers: details['Developers'] ?? [], worksOn: details['Works on'] ?? [], rating }
    return ld ? { name: ld.name, image: ld.image, releaseDate: ld.releaseDate ?? null, lowPrice: ld.offers?.lowPrice, prices, crumbs, req, extra } : null
  })
  if (!data?.name || !data.image) return null
  const distinct = [...new Set(data.prices)].filter((p) => p > 0)
  if (distinct.length === 0 && data.lowPrice) distinct.push(Math.round(data.lowPrice * 100))
  if (distinct.length === 0) return null
  const listPrice = Math.max(...distinct)
  const offers = distinct.filter((p) => p !== listPrice || distinct.length === 1).sort((a, b) => a - b).slice(0, 6)
  return {
    slug, url: `https://www.eneba.com/${slug}`, name: data.name, image: data.image, releaseDate: data.releaseDate,
    type: typeFromCrumbs(data.crumbs, fallbackType), platform: platformOf(slug), region: regionOf(slug),
    listPriceCents: listPrice, offerPricesCents: offers, requirements: Object.keys(data.req).length ? data.req : null,
    details: data.extra,
  }
}

const added = []
for (const src of detailsOnly ? [] : SOURCES) {
  const queue = []
  for (const url of src.urls) {
    try {
      for (const s of await listingSlugs(url)) if (!queue.includes(s)) queue.push(s)
    } catch (e) {
      console.log(`listing failed ${url}: ${e.message.split('\n')[0]}`)
    }
  }
  let got = 0
  for (const slug of queue) {
    if (got >= perSource) break
    if (known.has(slug) && known.get(slug).requirements !== undefined) { got++; continue } // already captured
    try {
      const p = await product(slug, src.type)
      if (p) {
        known.set(slug, p)
        added.push(p)
        got++
        console.log(`[${src.name}] ${p.type}/${p.platform}/${p.region}: ${p.name}${p.requirements ? ' (+requirements)' : ''}`)
      } else console.log(`[${src.name}] skip ${slug}`)
    } catch (e) {
      console.log(`[${src.name}] skip ${slug}: ${e.message.split('\n')[0]}`)
    }
    await sleep(PAUSE_MS)
  }
}
// Entries from the first snapshot have no requirements field yet: visit them once more.
for (const [slug, old] of known) {
  if (old.requirements !== undefined) continue
  try {
    const p = await product(slug, old.type ?? 'game')
    if (p) { known.set(slug, p); console.log(`[refresh] ${p.name}${p.requirements ? ' (+requirements)' : ''}`) }
    else known.set(slug, { ...old, type: old.type ?? 'game', requirements: null })
  } catch (e) {
    known.set(slug, { ...old, type: old.type ?? 'game', requirements: null })
  }
  await sleep(PAUSE_MS)
}
// Same game on another platform/region shares genres and "Other details": visit one listing per
// game and copy the result to its siblings (far fewer page loads).
const baseName = (n) =>
  n.replace(/\s*\(.*?\)/g, '').split(/\s+(?:steam|xbox|psn|nintendo|gog|epic|ea app|origin|ubisoft|rockstar|battle\.net|windows|microsoft|pc)\b/i)[0].toLowerCase().replace(/^[\s:-]+|[\s:-]+$/g, '')
const hasGenres = (p) => p.details && Array.isArray(p.details.genres) && p.details.genres.length > 0
function shareDetails() {
  const byName = new Map()
  for (const p of known.values()) if (hasGenres(p) && !byName.has(baseName(p.name))) byName.set(baseName(p.name), p.details)
  let copied = 0
  for (const [slug, p] of known) {
    const d = byName.get(baseName(p.name))
    if (d && !hasGenres(p)) {
      known.set(slug, { ...p, details: { ...d, rating: p.details?.rating ?? d.rating } })
      copied++
    }
  }
  return copied
}
if (detailsOnly) {
  let n = 0
  shareDetails()
  for (const [slug, old0] of known) {
    const old = known.get(slug) ?? old0
    if (!['game', 'dlc'].includes(old.type) && old.details) continue // gift cards, software: no genres on Eneba
    if (hasGenres(old)) continue
    if ([...known.values()].some((p) => p !== old && hasGenres(p) && baseName(p.name) === baseName(old.name))) continue
    try {
      const p = await product(slug, old.type ?? 'game')
      if (p) {
        // keep the listing-time type/prices; take requirements/details from the fresh visit
        known.set(slug, { ...old, details: p.details, requirements: old.requirements ?? p.requirements })
        n++
        console.log(`[details ${n}] ${old.name}: ${p.details.genres.slice(0, 3).join(', ')}${p.details.rating ? ` · ${p.details.rating.value}/5` : ''}`)
      }
    } catch (e) {
      console.log(`[details] skip ${slug}: ${e.message.split('\n')[0]}`)
    }
    shareDetails()
    // save progress every 20 products so an interrupted run isn't lost
    if (n % 20 === 0) writeFileSync(OUT, JSON.stringify({ source: 'https://www.eneba.com', scrapedAt: previous.scrapedAt, products: [...known.values()] }, null, 1))
    await sleep(PAUSE_MS)
  }
}
if (detailsOnly) console.log(`copied details to ${shareDetails()} sibling listings`)
await browser.close()

// Older entries (first snapshot) had no type: they came from the games listing.
const products = [...known.values()].map((p) => ({ type: 'game', requirements: null, ...p }))
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ source: 'https://www.eneba.com', scrapedAt: new Date().toISOString(), products }, null, 1))
console.log(`added ${added.length}; snapshot now has ${products.length} products -> ${OUT}`)
