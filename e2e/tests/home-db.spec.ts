import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'

// Proves the homepage is backend-driven: editing the home_sections table changes the page
// without touching frontend code. Needs direct database access, so it runs locally only.
const db = process.env.E2E_DATABASE_URL ?? (process.env.BASE_URL ? undefined : 'postgres:///eneba')
const sql = (q: string) => execFileSync('psql', [db!, '-v', 'ON_ERROR_STOP=1', '-Atc', q]).toString().trim()

test.skip(!db, 'needs E2E_DATABASE_URL (local database)')

test('homepage blocks come from the database', async ({ page }) => {
  const original = sql(`SELECT title FROM home_sections WHERE key = 'deals'`)
  try {
    sql(`UPDATE home_sections SET title = 'E2E changed title', position = 25 WHERE key = 'deals'`)
    sql(`UPDATE home_sections SET enabled = false WHERE key = 'upcoming'`)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: 'E2E changed title' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Upcoming games' })).toHaveCount(0)
    const headings = await page.getByRole('heading', { level: 2 }).allTextContents()
    expect(headings.indexOf('E2E changed title')).toBeLessThan(headings.indexOf('Top games'))
  } finally {
    sql(`UPDATE home_sections SET title = '${original.replace(/'/g, "''")}', position = 40 WHERE key = 'deals'`)
    sql(`UPDATE home_sections SET enabled = true WHERE key = 'upcoming'`)
  }
})
