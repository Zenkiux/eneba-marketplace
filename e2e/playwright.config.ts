import { defineConfig, devices } from '@playwright/test'

// Runs against the local dev servers by default; set BASE_URL to test the deployed app.
//   npx playwright test                         (local: start `make api` and `make web` first)
//   BASE_URL=https://<app>.vercel.app npx playwright test
export default defineConfig({
  testDir: './tests',
  globalTeardown: './teardown.ts',
  timeout: 90_000, // a sleeping free-tier API can take ~1 minute to wake up
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
})
