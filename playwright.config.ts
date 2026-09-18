import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import path from 'path'

// Playwright doesn't get Next.js's automatic .env.local loading (that only
// applies inside `next dev`/`next build`), so load it explicitly here.
loadEnv({ path: path.resolve(__dirname, '.env.local') })

const PORT = process.env.E2E_PORT ?? '3100'
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests share one seeded account/outlet — avoid racing stock changes
  // fullyParallel only serializes tests *within* a file — multiple spec files
  // still ran on separate workers by default, which raced real login
  // sessions/cart state against each other across files (found live: adding
  // journal-accounting-integration.spec.ts and signup-login-roundtrip.spec.ts
  // made pos.spec.ts and auth.spec.ts flake when run together). One worker
  // serializes across files too — these are stateful E2E tests against a
  // shared backend, not independent unit tests, so correctness beats speed.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
