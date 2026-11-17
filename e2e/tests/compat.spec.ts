import { expect, test } from '@playwright/test'

// The owner's proposed feature: "Will it work for me?"
const profile = (p: object) =>
  JSON.stringify({ country: 'LT', os: 'windows', gpuName: 'GeForce RTX 3060', gpuScore: 8800, cpuLabel: 'x', cpuScore: 1100, ramGb: 16, consoles: [], detected: false, ...p })

test('product page and cards explain why a key will or won’t work', async ({ page }) => {
  await page.addInitScript((p) => localStorage.setItem('keyshop.device.v1', p), profile({ os: 'mac' }))
  await page.goto('/p/starfall-odyssey-steam-global')
  const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Will it work for me?' }) })
  await expect(panel.getByText('Region: Global')).toBeVisible()
  await expect(panel.getByText(/Below minimum: needs another operating system/)).toBeVisible()
  await expect(panel.getByRole('table').first()).toContainText('Graphics')

  await page.goto('/p/starfall-odyssey-psn-europe')
  await expect(page.getByText(/Needs a PlayStation, which isn’t in your setup/)).toBeVisible()
})

test('“Works for me” filter narrows the store and appears as a chip', async ({ page }) => {
  await page.addInitScript((p) => localStorage.setItem('keyshop.device.v1', p), profile({ gpuScore: 1300, cpuScore: 750, ramGb: 8 }))
  await page.goto('/store')
  const count = page.getByText(/Results found:/)
  await expect(count).toContainText(/\d+/)
  const all = Number((await count.textContent())!.match(/\d+/)![0])
  await page.getByRole('checkbox', { name: /Works for me/ }).click()
  await expect(page).toHaveURL(/works=1/)
  await expect(page.getByRole('button', { name: 'Remove filter Works for me' })).toBeVisible()
  await expect(count).not.toHaveText(`Results found: ${all}`)
  const some = Number((await count.textContent())!.match(/\d+/)![0])
  expect(some).toBeGreaterThan(0)
  expect(some).toBeLessThan(all)
  await expect(page.getByText('Works for you').first()).toBeVisible()
})

test('setup page: detect, save, see matches and check any game', async ({ page }) => {
  await page.goto('/will-it-work')
  await page.getByRole('button', { name: 'Detect my PC' }).click()
  await page.getByLabel('Country').selectOption('LT')
  await page.getByLabel('Operating system').selectOption('windows')
  await page.getByLabel('Graphics card').fill('GeForce RTX 3060')
  await page.getByLabel('Processor').selectOption({ index: 4 })
  await page.getByLabel('Memory (RAM)').selectOption('16')
  await page.getByRole('button', { name: /Save my setup|Update my setup/ }).click()
  await expect(page.getByRole('heading', { name: /Works for you · \d+ products/ })).toBeVisible()
  await page.getByLabel('Game to check').fill('starfal')
  await expect(page.getByRole('link', { name: /Starfall Odyssey \(PC\)/ }).first()).toBeVisible()
  await expect(page.getByText('Works for you').first()).toBeVisible()
})

test('proposal notes explain the feature to the team', async ({ page }) => {
  await page.goto('/will-it-work')
  await expect(page.getByRole('button', { name: 'Proposal', exact: false })).toHaveCount(0)
  await page.getByRole('switch', { name: 'Proposal notes' }).first().click()
  await page.getByRole('button', { name: /Proposal/ }).first().click()
  await expect(page.getByRole('dialog').getByText('Problem')).toBeVisible()
  await page.goto('/proposal')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Will it work for me?')
})
