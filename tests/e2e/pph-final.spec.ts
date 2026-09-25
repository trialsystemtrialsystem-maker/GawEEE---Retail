import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// PPh Final UMKM report: 12 months, respects the settings, and the entity regime
// (threshold 0) taxes every rupiah at the configured rate. Defaults restored after.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('pph final follows the tax settings', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const year = new Date().toISOString().slice(0, 4)
  try {
    expect((await api(page, 'PATCH', '/api/admin/tax-settings', { enabled: true, rate_percent: 0.5, threshold: 0 })).status).toBe(200)
    const badan = await api(page, 'GET', `/api/reports/pph-final?year=${year}&outlet_id=all`)
    expect(badan.status).toBe(200)
    expect(badan.json.months).toHaveLength(12)
    expect(badan.json.totals.tax_due).toBeCloseTo(badan.json.totals.gross_turnover * 0.005, -1)

    expect((await api(page, 'PATCH', '/api/admin/tax-settings', { enabled: false, rate_percent: 0.5, threshold: 0 })).status).toBe(200)
    expect((await api(page, 'GET', `/api/reports/pph-final?year=${year}&outlet_id=all`)).json.totals.tax_due).toBe(0)
    expect((await api(page, 'PATCH', '/api/admin/tax-settings', { enabled: true, rate_percent: 500, threshold: 0 })).status).toBe(400)
  } finally {
    await api(page, 'PATCH', '/api/admin/tax-settings', { enabled: true, rate_percent: 0.5, threshold: 500_000_000 })
  }
  await page.goto('/dashboard/financial/tax-report')
  await expect(page.getByRole('heading', { name: 'PPh Final UMKM' })).toBeVisible({ timeout: 60_000 })
})
