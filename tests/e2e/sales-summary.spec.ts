import { test, expect, type Page } from '@playwright/test'
import { login, currentOutletId, pickInStockProduct } from './helpers'

// Sales Summary report: figures move with a real sale and come back on void,
// and the page renders.
const EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('sales summary reflects a sale and its void', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, EMAIL, PASSWORD)
  const outletId = await currentOutletId(page)
  const product = await pickInStockProduct(page, outletId)
  const day = new Date().toISOString().slice(0, 10)
  const url = `/api/reports/sales-summary?outlet_id=${outletId}&start=${day}&end=${day}&group=day`

  const before = (await api(page, 'GET', url)).json
  expect(before.totals).toBeDefined()
  expect(Array.isArray(before.trend)).toBe(true)
  expect(before.range.previous.end < day).toBe(true)

  const sale = await api(page, 'POST', '/api/invoices', { outlet_id: outletId, items: [{ product_id: product.product_id, quantity: 1 }], payment_method: 'cash' })
  expect(sale.status).toBe(201)
  const invoiceId: string = sale.json.invoice_id
  try {
    const after = (await api(page, 'GET', url)).json
    expect(after.totals.invoice_count).toBe(before.totals.invoice_count + 1)
    expect(after.totals.total).toBeGreaterThan(before.totals.total)
    expect(after.topProducts.some((p: { key: string }) => p.key === product.product_id)).toBe(true)
    expect(after.byCashier.length).toBeGreaterThan(0)
    expect(after.trend.at(-1).key).toBe(day)
  } finally {
    await api(page, 'POST', `/api/invoices/${invoiceId}/void`, { reason: 'Pembersihan uji ringkasan penjualan' })
  }
  const voided = (await api(page, 'GET', url)).json
  expect(voided.totals.invoice_count).toBe(before.totals.invoice_count)
  expect(voided.totals.void_count).toBe(before.totals.void_count + 1)

  await page.goto('/dashboard/sales/reports/summary')
  await expect(page.getByRole('heading', { name: 'Ringkasan Penjualan' })).toBeVisible()
  await expect(page.getByText('Total Penjualan')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Metode Pembayaran')).toBeVisible()
})
