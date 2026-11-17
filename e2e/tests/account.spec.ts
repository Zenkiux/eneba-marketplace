import { expect, test } from '@playwright/test'
import { uniqueEmail } from './helpers'

async function register(page: import('@playwright/test').Page, email: string) {
  await page.goto('/register')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible()
}

test('account area: menu, overview, sidebar, profile, password, login history', async ({ page }) => {
  const email = uniqueEmail('account')
  await register(page, email)

  // Header user menu like Eneba's.
  await page.getByRole('button', { name: 'User menu' }).click()
  await expect(page.locator('header').getByRole('link', { name: 'Keys library' })).toBeVisible()
  await page.getByRole('link', { name: 'My account' }).first().click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible()
  await expect(page.getByText(email).first()).toBeVisible()

  // Sidebar groups open and navigate.
  const side = page.getByRole('complementary', { name: 'Account menu' })
  await side.getByRole('button', { name: 'Settings' }).click()
  await side.getByRole('link', { name: 'My personal info' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Display name').fill('Night Owl')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Night Owl')).toBeVisible()

  await side.getByRole('link', { name: 'Change password' }).click()
  await page.getByLabel('Enter your old password').fill('wrong-password')
  await page.getByLabel('Enter your new password').fill('new-password-456')
  await page.getByLabel('Repeat your new password').fill('new-password-456')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toContainText('current password is wrong')
  await page.getByLabel('Enter your old password').fill('e2e-password-123')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Password changed' })).toBeVisible()

  await side.getByRole('button', { name: 'My account' }).click()
  await side.getByRole('link', { name: 'Login history' }).click()
  await expect(page.getByText('This device')).toBeVisible()

  await side.getByRole('link', { name: 'Keys library' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My library' })).toBeVisible()
  await expect(page.getByText('Keys you buy will be listed here.')).toBeVisible()
})

test('favorites: heart on a product, list on /wishlist, guests are asked to log in', async ({ page }) => {
  await page.goto('/p/starfall-odyssey-steam-global')
  await page.getByRole('button', { name: /Add .* to favorites/ }).first().click()
  await expect(page).toHaveURL(/\/login\?next=/)

  await register(page, uniqueEmail('fav'))
  await page.goto('/p/starfall-odyssey-steam-global')
  const heart = page.locator('main').getByRole('button', { name: /^Add Starfall Odyssey.* to favorites$/ }).first()
  await heart.click()
  await expect(page.locator('main').getByRole('button', { name: /^Remove Starfall Odyssey.* from favorites$/ }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Favorites' }).first().click()
  await expect(page).toHaveURL(/\/wishlist$/)
  await expect(page.getByRole('link', { name: /^Starfall Odyssey/ }).first()).toBeVisible()
})
