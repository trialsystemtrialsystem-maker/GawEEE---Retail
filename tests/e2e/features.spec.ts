import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Master Admin > Menu & Fitur (todo.md Phase 32 batch 4): switching a module
// off persists, the owner still sees it marked "nonaktif", and it is restored.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('disabling a module persists and is marked for the owner; restore works', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  try {
    expect((await api(page, 'PATCH', '/api/admin/features', { key: 'bookings', enabled: false })).status).toBe(200)
    expect((await api(page, 'PATCH', '/api/admin/features', { key: 'nope', enabled: false })).status).toBe(400)
    const flags = await api(page, 'GET', '/api/features')
    expect(flags.json.features.bookings).toBe(false)
    expect(flags.json.is_master).toBe(true)

    await page.goto('/dashboard/admin/features')
    await page.getByRole('button', { name: /More/ }).click()
    await expect(page.getByRole('navigation', { name: 'Navigasi modul' }).getByRole('link', { name: /Booking.*nonaktif/ })).toBeVisible({ timeout: 30_000 })
  } finally {
    await api(page, 'PATCH', '/api/admin/features', { key: 'bookings', enabled: true })
  }
  const after = await api(page, 'GET', '/api/features')
  expect(after.json.features.bookings).toBe(true)
})
