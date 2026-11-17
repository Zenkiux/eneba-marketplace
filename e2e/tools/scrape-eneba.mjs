// One-off, polite snapshot of eneba.com product listings for the optional "Eneba catalog" switch.
//   node tools/scrape-eneba.mjs [--limit=36]   ->  data/eneba-snapshot.json (gitignored)
//
// Rules this script follows:
// - only listing pages (/store/...) and product pages, both allowed by eneba.com/robots.txt
//   (it never touches /search, /checkout, /payment or account pages);
// - one page at a time with a 3-second pause between requests, run by hand, not on a schedule;
// - reads the schema.org Product data each page publishes plus the visible offer prices;
// - stores titles, cover image URLs and prices only (no descriptions or reviews). Images are not
//   downloaded: the app links to Eneba's image CDN.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 36)
const PAUSE_MS = 3000
const LISTINGS = ['https://www.eneba.com/store/games', 'https://www.eneba.com/store/games?page=2']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Slug prefix → our platform slug. Eneba product slugs start with the activation platform.
const PLATFORMS = [
  ['steam', 'steam'], ['xbox', 'xbox'], ['psn', 'psn'], ['nintendo', 'nintendo'], ['gog', 'gog'], ['epic', 'epic'],
  ['ea', 'ea'], ['origin', 'ea'], ['ubisoft', 'ubisoft'], ['uplay', 'ubisoft'], ['rockstar', 'rockstar'], ['battle-net', 'battlenet'], ['other', 'other'],
]
// Slug suffix → region slug.
const REGIONS = [['north-america', 'north-america'], ['united-states', 'north-america'], ['united-kingdom', 'united-kingdom'], ['europe', 'europe'], ['emea', 'europe'], ['global', 'global']]

function platformOf(slug) {
  return PLATFORMS.find(([p]) => slug.startsWith(p + '-'))?.[1] ?? 'other'
}
function regionOf(slug) {
  return REGIONS.find(([r]) => slug.endsWith('-' + r))?.[1] ?? 'global'
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.route('**/*', (route) => {
  // Don't load images/media/fonts while scraping: less traffic for eneba.com.
  const t = route.request().resourceType()
  return ['image', 'media', 'font'].includes(t) ? route.abort() : route.continue()
})

const slugs = []
for (const url of LISTINGS) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const found = await page.$$eval('main a[href]', (as) => as.map((a) => a.getAttribute('href')))
  for (const href of found) {
    if (/^\/[a-z0-9-]+$/.test(href) && /-(key|gift|account)-/.test(href) && !slugs.includes(href.slice(1))) slugs.push(href.slice(1))
  }
  console.log(`listing ${url}: ${slugs.length} product links so far`)
  await sleep(PAUSE_MS)
}

const products = []
for (const slug of slugs.slice(0, limit)) {
  const url = `https://www.eneba.com/${slug}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)
    const data = await page.evaluate(() => {
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((s) => { try { return JSON.parse(s.textContent) } catch { return null } })
        .find((x) => x && x['@type'] === 'Product')
      const prices = [...document.querySelectorAll('main span')]
        .filter((e) => e.children.length === 0 && /^€\d+(\.\d\d)?$/.test(e.textContent.trim()))
        .map((e) => Math.round(Number(e.textContent.trim().slice(1)) * 100))
      return ld ? { name: ld.name, image: ld.image, releaseDate: ld.releaseDate ?? null, lowPrice: ld.offers?.lowPrice, prices } : null
    })
    if (!data?.name || !data.image) {
      console.log(`skip ${slug}: no product data`)
    } else {
      const distinct = [...new Set(data.prices)].filter((p) => p > 0)
      const listPrice = Math.max(...distinct, Math.round((data.lowPrice ?? 0) * 100))
      const offerPrices = distinct.filter((p) => p !== listPrice || distinct.length === 1).sort((a, b) => a - b).slice(0, 6)
      products.push({
        slug, url, name: data.name, image: data.image, releaseDate: data.releaseDate,
        platform: platformOf(slug), region: regionOf(slug), listPriceCents: listPrice, offerPricesCents: offerPrices,
      })
      console.log(`ok ${products.length}: ${data.name} (${offerPrices.length} prices)`)
    }
  } catch (e) {
    console.log(`skip ${slug}: ${e.message.split('\n')[0]}`)
  }
  await sleep(PAUSE_MS)
}
await browser.close()

const out = join(root, 'data/eneba-snapshot.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ source: 'https://www.eneba.com', scrapedAt: new Date().toISOString(), products }, null, 1))
console.log(`wrote ${products.length} products to ${out}`)
