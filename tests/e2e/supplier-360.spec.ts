import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Supplier 360: scorecard endpoint, whitelisted edit (no mass assignment), page renders.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('supplier profile, safe edit, and detail page', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const list = await api(page, 'GET', '/api/suppliers')
  const supplier = list.json.suppliers[0]
  expect(supplier).toBeTruthy()

  const profile = await api(page, 'GET', `/api/suppliers/${supplier.id}/profile`)
  expect(profile.status).toBe(200)
  expect(profile.json.kpi).toHaveProperty('total_purchased')
  expect(profile.json.kpi).toHaveProperty('on_time_rate')
  expect(Array.isArray(profile.json.products)).toBe(true)

  // Unknown fields are dropped, so a body that only tries to move the row to
  // another company changes nothing and is rejected.
  const attack = await api(page, 'PUT', `/api/suppliers/${supplier.id}`, { company_id: '00000000-0000-0000-0000-000000000000' })
  expect(attack.status).toBe(400)
  expect((await api(page, 'PUT', `/api/suppliers/${supplier.id}`, { rating: 9 })).status).toBe(400)

  const original = profile.json.supplier.rating
  expect((await api(page, 'PUT', `/api/suppliers/${supplier.id}`, { rating: 4.5 })).status).toBe(200)
  expect((await api(page, 'GET', `/api/suppliers/${supplier.id}/profile`)).json.supplier.rating).toBe(4.5)
  await api(page, 'PUT', `/api/suppliers/${supplier.id}`, { rating: original })

  await page.goto(`/dashboard/suppliers/${supplier.id}`)
  await expect(page.getByRole('heading', { name: new RegExp(supplier.name) })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Ketepatan Kirim')).toBeVisible()
})
