// Captures screenshots for the visual acceptance process (docs/testing-plan.md).
//   node visual/capture.mjs reference   -> design/reference/  (eneba.com; local only, gitignored)
//   node visual/capture.mjs app [base]  -> docs/design/app/    (our app, default http://localhost:5173)
// Cookie/consent overlays on eneba.com are hidden with CSS for the screenshot; no consent is given.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const mode = process.argv[2] ?? 'app'
const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 375, height: 812 } }

const pages = mode === 'reference'
  ? {
      home: 'https://www.eneba.com/',
      store: 'https://www.eneba.com/store/games',
      product: 'https://www.eneba.com/steam-gift-project-zomboid-steam-gift-global',
      login: 'https://my.eneba.com/login',
      notfound: 'https://www.eneba.com/this-page-does-not-exist',
    }
  : Object.fromEntries(Object.entries({
      home: '/', store: '/store', product: '/p/starfall-odyssey-steam-global', login: '/login', notfound: '/this-page-does-not-exist',
    }).map(([k, v]) => [k, (process.argv[3] ?? 'http://localhost:5173') + v]))

const outDir = mode === 'reference' ? join(root, 'design/reference') : join(root, 'docs/design/app')
const only = process.argv[4]?.split(',')
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
for (const [vpName, vp] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vpName === 'mobile', hasTouch: vpName === 'mobile' })
  const page = await ctx.newPage()
  for (const [name, url] of Object.entries(pages)) {
    if (only && !only.includes(name)) continue
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3500)
    if (mode === 'reference') {
      await page.addStyleTag({ content: '[id*="cookie" i],[class*="cookie" i],[class*="consent" i],[id*="consent" i],[class*="Cookie"],[aria-label*="cookie" i]{display:none!important}' })
    }
    const file = join(outDir, `${name}-${vpName}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log(file)
  }
  await ctx.close()
}
await browser.close()
