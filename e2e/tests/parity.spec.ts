import { expect, test } from '@playwright/test'
import { checkoutAsNewUser, addChosenOffer, uniqueEmail } from './helpers'

// Features matched to eneba.com (see docs/design/visual-review.md, review #6).

test('homepage: recently viewed, recommended, gift cards, categories and "See all"', async ({ page }) => {
  await page.goto('/p/starfall-odyssey-steam-global')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/')
  const recent = page.locator('section', { has: page.getByRole('heading', { name: 'Recently viewed' }) })
  await expect(recent.getByRole('link', { name: /^Starfall Odyssey \(PC\)/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recommended for you' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Best selling gift cards' })).toBeVisible()
  const cats = page.locator('section', { has: page.getByRole('heading', { name: 'Categories' }) })
  await cats.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/store\?genre=/)
  await page.goto('/')
  await page.getByRole('link', { name: 'See all' }).first().click()
  await expect(page).toHaveURL(/\/store\?/)
})

test('store: genre, operating system and country filters', async ({ page }) => {
  await page.goto('/store')
  const count = page.getByText(/Results found:/)
  await expect(count).toContainText(/\d+/)
  const all = Number((await count.textContent())!.match(/\d+/)![0])
  await page.getByRole('combobox', { name: 'Country' }).selectOption('US')
  await expect(page).toHaveURL(/country=US/)
  await expect(count).not.toHaveText(`Results found: ${all}`)
  // The demo games are Windows-only (their requirements say so).
  await page.getByRole('checkbox', { name: /^Windows/ }).click()
  await expect(page).toHaveURL(/os_filter=windows/)
  await expect(page.getByRole('button', { name: 'Remove filter Windows' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all' }).click()
  await page.getByRole('group', { name: /Genres/ }).getByRole('checkbox').first().click()
  await expect(page).toHaveURL(/genre=/)
})

test('card "Add to cart" adds the cheapest offer', async ({ page }) => {
  await page.goto('/store')
  const card = page.getByRole('button', { name: /^Add to cart: / }).first()
  await card.hover()
  await card.click()
  await expect(page.getByRole('status').filter({ hasText: 'Added to cart' })).toBeVisible()
})

test('product page: also viewed, other details, reviews only from buyers', async ({ page }) => {
  await page.goto('/p/starfall-odyssey-steam-global')
  await expect(page.getByRole('heading', { name: 'Gamers also viewed' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Other details' })).toBeVisible()
  await expect(page.getByText('Works on:')).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Reviews: \d+$/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in to review' })).toBeVisible()

  // Buy it, then review it.
  const { title } = await addChosenOffer(page)
  await checkoutAsNewUser(page, uniqueEmail('review'))
  await page.getByRole('link', { name: title }).first().click()
  await page.getByRole('button', { name: 'Review now' }).click()
  await page.getByRole('radio', { name: '4 stars' }).check({ force: true })
  const text = `The key worked right away. Great space game. (${Date.now()})`
  await page.getByLabel('Your review', { exact: true }).fill(text)
  await page.getByRole('button', { name: 'Publish review' }).click()
  await expect(page.getByRole('button', { name: 'Publish review' })).toHaveCount(0) // form closes
  await expect(page.getByRole('paragraph').filter({ hasText: text })).toBeVisible()
  await expect(page.getByText('Your review', { exact: true }).first()).toBeVisible()
})

test('footer: newsletter sign-up and help page', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')
  await footer.getByLabel('Your e-mail').fill(uniqueEmail('news'))
  await footer.getByRole('button', { name: 'Subscribe' }).click()
  await expect(footer.getByRole('status')).toContainText('Subscribed')
  await footer.getByRole('link', { name: 'How to activate game' }).click()
  await expect(page).toHaveURL(/\/help#activate$/)
  await expect(page.getByRole('heading', { name: 'How to activate a game key' })).toBeInViewport()
})
