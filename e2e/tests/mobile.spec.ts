import { expect, test } from '@playwright/test'

test('mobile: menu, search and two-column store grid', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Categories', exact: true }).getByRole('link', { name: 'Games' })).toBeVisible()
  await page.getByRole('button', { name: 'Close menu' }).click()

  await page.getByRole('button', { name: 'Search' }).click()
  const search = page.getByRole('combobox', { name: 'Search products' })
  await search.fill('frostbnd')
  await search.press('Enter')
  await expect(page).toHaveURL(/\/store\?q=frostbnd/)
  const cards = page.locator('main a[href^="/p/"]')
  await expect(cards.first()).toBeVisible()

  await page.goto('/store')
  const boxes = await page.locator('main a[href^="/p/"]').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().top))
  expect(boxes[0]).toBe(boxes[1]) // two cards side by side
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
