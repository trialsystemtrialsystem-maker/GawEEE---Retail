import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Owner's active outlet: switching persists (cookie), is reflected by
// /api/outlets and the header switcher, cannot be set to an outlet outside the
// company, and is restored afterwards.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('owner can switch the active outlet and it sticks', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const before = await api(page, 'GET', '/api/outlets')
  const original: string = before.json.active_outlet_id
  const other = before.json.outlets.find((o: { id: string }) => o.id !== original)
  test.skip(!other, 'needs a company with at least two outlets')

  try {
    expect((await api(page, 'POST', '/api/outlets/active', { outlet_id: '00000000-0000-0000-0000-000000000000' })).status).toBe(403)
    expect((await api(page, 'POST', '/api/outlets/active', { outlet_id: other.id })).status).toBe(200)
    expect((await api(page, 'GET', '/api/outlets')).json.active_outlet_id).toBe(other.id)

    // An outlet-scoped page now renders for that outlet, and the header shows it.
    await page.goto('/dashboard/inventory/expiry')
    await expect(page.getByRole('heading', { name: 'Laporan Kadaluarsa' })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByLabel('Outlet aktif')).toHaveValue(other.id)
  } finally {
    await api(page, 'POST', '/api/outlets/active', { outlet_id: original })
  }
})
