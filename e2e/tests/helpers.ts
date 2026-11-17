import { expect, type Page } from '@playwright/test'

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`

/**
 * On a product page, adds the most expensive in-stock offer (so the test proves the chosen
 * seller — not simply the cheapest one — is what gets bought). Returns the seller name.
 */
export async function addChosenOffer(page: Page): Promise<{ seller: string; title: string }> {
  // Client-side navigation: wait for the product page itself, not the previous page's heading.
  await expect(page).toHaveURL(/\/p\//)
  await expect(page.locator('#offers')).toBeVisible()
  const title = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? ''
  const rows = page.locator('#offers li').filter({ has: page.getByRole('button', { name: /^Add to cart:/ }) })
  const count = await rows.count()
  expect(count, 'product should have at least one in-stock offer').toBeGreaterThan(0)
  const chosen = rows.nth(count - 1) // offers are sorted by price: last in-stock row is the priciest
  const label = await chosen.getByRole('button', { name: /^Add to cart:/ }).getAttribute('aria-label')
  const seller = label!.split(' from ').pop()!
  await chosen.getByRole('button', { name: /^Add to cart:/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Added to cart' })).toBeVisible()
  return { seller, title }
}

/** From the cart as a guest: checkout → create an account → Payment (decline first, then succeed) → keys. */
export async function checkoutAsNewUser(page: Page, email: string) {
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Log in and checkout' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/)
  await page.getByRole('link', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/register\?next=%2Fcheckout/)
  // Wait for the register form itself: the login form (same field labels) may still be on screen.
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()

  // Like Eneba, "Proceed to checkout" goes straight to Payment (the order and key reservation are created on the way).
  await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}\/pay$/)
  await expect(page.getByRole('heading', { name: /Demo payment — no real money is charged/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled() // no method chosen yet

  await page.getByRole('radio', { name: /Declined card/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'declined' })).toBeVisible()

  await page.getByRole('radio', { name: /Credit or debit card/ }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Thank you! Here are your keys' })).toBeVisible()
}
