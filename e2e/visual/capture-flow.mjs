// Screenshots of the signed-in purchase screens (cart, checkout, payment, order, history, 404)
// for the visual review. Creates a throwaway account and a demo order on the target app.
//   node visual/capture-flow.mjs [baseUrl]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = process.argv[2] ?? 'http://localhost:5173'
const out = join(root, 'docs/design/app')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
for (const [vp, size] of Object.entries({ desktop: { width: 1280, height: 800 }, mobile: { width: 375, height: 812 } })) {
  const ctx = await browser.newContext({ viewport: size, isMobile: vp === 'mobile', hasTouch: vp === 'mobile' })
  const page = await ctx.newPage()
  const api = page.request
  const json = { 'Content-Type': 'application/json' }
  await api.post(`${base}/api/auth/register`, { headers: json, data: { email: `visual-${vp}-${Date.now()}@example.test`, password: 'visual-password-1', displayName: 'Visual Check' } })
  const product = await (await api.get(`${base}/api/products/hollow-crown-steam-global`)).json()
  const offers = product.offers.filter((o) => o.stock > 0).slice(0, 2)
  for (const o of offers) await api.put(`${base}/api/cart/items/${o.id}`, { headers: json, data: { quantity: 1 } })

  const shot = async (name) => {
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(out, `${name}-${vp}.png`) })
    console.log(`${name}-${vp}.png`)
  }
  await page.goto(`${base}/cart`); await shot('cart')
  await page.goto(`${base}/checkout`)
  await page.waitForURL(/\/pay$/); await shot('payment')
  await page.getByRole('radio', { name: /Credit or debit card/ }).check(); await shot('payment-selected')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(/\/orders\//); await shot('order')
  await page.goto(`${base}/account/orders`); await shot('orders')
  await page.goto(`${base}/no-such-page`); await shot('notfound')
  await ctx.close()
}
await browser.close()
