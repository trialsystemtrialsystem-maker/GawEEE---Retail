import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Customer 360: history is matched by normalized phone (0812… on the customer,
// +62 812… on the sale), voided sales drop out, and the page renders.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('customer profile matches sales by phone and ignores voided ones', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const suffix = String(Date.now()).slice(-8)

  const created = await api(page, 'POST', '/api/customers', { outlet_id: outletId, name: 'E2E Pelanggan 360', phone: `0857${suffix}` })
  expect(created.status).toBe(201)
  const customerId: string = created.json.customer?.id ?? created.json.id

  const before = await api(page, 'GET', `/api/customers/${customerId}/profile`)
  expect(before.status).toBe(200)
  expect(before.json.kpi.orders).toBe(0)
  expect(before.json.kpi.segment).toBe('inactive')

  const item = (await api(page, 'GET', `/api/inventory/${outletId}`)).json.inventory.find((i: { quantity_on_hand: number }) => i.quantity_on_hand > 5)
  const sale = await api(page, 'POST', '/api/invoices', { outlet_id: outletId, customer_name: 'E2E Pelanggan 360', customer_phone: `+62 857${suffix}`, items: [{ product_id: item.product_id, quantity: 1 }], payment_method: 'cash' })
  expect(sale.status).toBe(201)

  const after = await api(page, 'GET', `/api/customers/${customerId}/profile`)
  expect(after.json.kpi.orders).toBe(1)
  expect(after.json.kpi.spend).toBeGreaterThan(0)
  expect(after.json.kpi.segment).toBe('new')
  expect(after.json.favorite_products[0].name).toBe(item.name)
  expect(after.json.invoices[0].id).toBe(sale.json.invoice_id)

  await page.goto(`/dashboard/sales/customers/${customerId}`)
  await expect(page.getByRole('heading', { name: /E2E Pelanggan 360/ })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Produk Favorit')).toBeVisible()

  // Voiding removes it from lifetime value.
  expect((await api(page, 'POST', `/api/invoices/${sale.json.invoice_id}/void`, { reason: 'E2E pelanggan 360 cleanup' })).status).toBe(200)
  const voided = await api(page, 'GET', `/api/customers/${customerId}/profile`)
  expect(voided.json.kpi.orders).toBe(0)
  expect(voided.json.kpi.spend).toBe(0)
})
