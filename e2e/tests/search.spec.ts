import { expect, test } from '@playwright/test'

// Abbreviations, numerals and typos (demo catalog).
for (const [q, expected] of [
  ['kingdom forge ii', 'Kingdom Forge 2'],
  ['tfv', 'Tiny Farm Valley'],
  ['shadow protokol', 'Shadow Protocol'],
] as const) {
  test(`search "${q}" finds ${expected}`, async ({ page }) => {
    await page.goto('/')
    const box = page.getByRole('combobox', { name: 'Search products' })
    await box.fill(q)
    // Products come after the phrase completions (as on Eneba).
    await expect(page.getByRole('option').filter({ has: page.locator('img') }).first()).toContainText(expected)
  })
}

test('search box: trending searches on focus, phrases and "Show all N results"', async ({ page }) => {
  await page.goto('/')
  const box = page.getByRole('combobox', { name: 'Search products' })
  await box.click()
  await expect(page.getByText('Trending searches')).toBeVisible()
  await expect(page.getByRole('option').first()).toBeVisible()
  await box.fill('starf')
  await expect(page.getByRole('option', { name: 'starfall odyssey', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Show all \d+ results$/ }).click()
  await expect(page).toHaveURL(/\/store\?q=starf/)
})

// Same with the Eneba snapshot (skipped where it isn't imported, e.g. CI).
test('Eneba catalog: "gta 6", "gta6" and "GTA VI" all find Grand Theft Auto VI', async ({ page, request }) => {
  const cats = await (await request.get('/api/catalogs')).json()
  test.skip(!cats.catalogs.some((c: { key: string }) => c.key === 'eneba'), 'Eneba snapshot not imported')
  await page.addInitScript(() => localStorage.setItem('keyshop.catalog', 'eneba'))
  for (const q of ['gta 6', 'gta6', 'GTA VI', 'grand theft auto vi', 'gta']) {
    await page.goto(`/store?q=${encodeURIComponent(q)}`)
    await expect(page.getByRole('link', { name: /Grand Theft Auto VI/ }).first(), q).toBeVisible()
  }
})
