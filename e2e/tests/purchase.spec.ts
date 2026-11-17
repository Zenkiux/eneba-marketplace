import { expect, test } from '@playwright/test'
import { addChosenOffer, checkoutAsNewUser, uniqueEmail } from './helpers'

// The assignment's purchase diagram: Homepage or Search → Product page → Cart → Checkout
// (sign-in required) → Payment → Order and key.

test('homepage → product → chosen seller → cart → sign-in → payment → key → order history', async ({ page }) => {
  await page.goto('/')
  const firstRow = page.locator('section').filter({ has: page.getByRole('heading', { level: 2 }) }).first()
  await expect(firstRow.getByRole('link').first()).toBeVisible()
  await firstRow.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/p\//)

  const { seller, title } = await addChosenOffer(page)
  await checkoutAsNewUser(page, uniqueEmail('home'))

  // The order contains the product and the seller that was chosen, and a key was delivered.
  await expect(page.getByRole('link', { name: title })).toBeVisible()
  await expect(page.getByText(`Seller: ${seller}`)).toBeVisible()
  const key = (await page.getByTestId('game-key').first().textContent())?.trim()
  expect(key).toMatch(/^DEMO-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/)
  const orderUrl = page.url()

  // Order history shows the paid order; opening it shows the same key again.
  await page.goto('/account/orders')
  const row = page.getByTestId('order-row').filter({ hasText: title })
  await expect(row.getByText('Order fulfilled')).toBeVisible()
  await expect(row.getByText('Credit or debit card')).toBeVisible()
  await row.getByRole('link', { name: /^Details/ }).click()
  await expect(page).toHaveURL(orderUrl)
  await expect(page.getByTestId('game-key').first()).toHaveText(key!)

  // The cart is empty after paying.
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
})

test('search with a typo from the header → product → purchase', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('combobox', { name: 'Search products' })
  await search.fill('starfal odysey')
  await expect(page.getByRole('option').first()).toContainText('Starfall Odyssey')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/store\?q=starfal/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “starfal odysey”')
  await page.getByRole('link', { name: /^Starfall Odyssey/ }).first().click()

  const { seller } = await addChosenOffer(page)
  await checkoutAsNewUser(page, uniqueEmail('search'))
  await expect(page.getByText(`Seller: ${seller}`)).toBeVisible()
  await expect(page.getByTestId('game-key').first()).toHaveText(/^DEMO-/)
})

test('checkout and order history require sign-in', async ({ page }) => {
  for (const path of ['/checkout', '/account/orders']) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`))
  }
  const res = await page.request.get('/api/orders')
  expect(res.status()).toBe(401)
})

test('store filters, sort and pagination use the API and the URL', async ({ page }) => {
  await page.goto('/store')
  const count = page.getByText(/Results found:/)
  await expect(count).toContainText(/\d+/)
  const all = Number((await count.textContent())!.match(/\d+/)![0])

  // The checkbox reflects the URL, which updates right after the click.
  const steamBox = page.getByRole('checkbox', { name: /^Steam/ })
  await steamBox.click()
  await expect(page).toHaveURL(/platform=steam/)
  await expect(steamBox).toBeChecked()
  await expect(count).not.toHaveText(`Results found: ${all}`)
  const steam = Number((await count.textContent())!.match(/\d+/)![0])
  const api = await (await page.request.get('/api/products?platform=steam&page_size=1')).json()
  expect(steam).toBe(api.total)

  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  await page.goBack()
  await expect(page).not.toHaveURL(/sort=price_asc/)
})
