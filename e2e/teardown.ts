import { execFileSync } from 'node:child_process'

// After a run, remove what the tests leave in *public* places of the site: reviews written by
// e2e accounts (shown on product pages), newsletter sign-ups of e2e addresses, and searches
// typed by the tests (they would appear under "Trending searches"). Orders and accounts of e2e
// users stay; they are private to those accounts. Runs only when a database URL is available.
export default function teardown() {
  const db = process.env.E2E_DATABASE_URL ?? (process.env.BASE_URL ? undefined : 'postgres:///eneba')
  if (!db) return
  execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-qAtc', `
    DELETE FROM product_reviews WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-%@example.test');
    DELETE FROM newsletter_subscribers WHERE email LIKE 'e2e-%@example.test';
    DELETE FROM search_queries WHERE query IN ('starf', 'starfal odysey', 'starfall', 'kingdom forge ii', 'tfv', 'shadow protokol',
      'gta 6', 'gta6', 'gta vi', 'grand theft auto vi', 'gta', 'frostbnd', 'starfal');`])
}
