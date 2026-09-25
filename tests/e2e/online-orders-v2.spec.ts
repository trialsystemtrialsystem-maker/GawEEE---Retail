import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Needs migration 067. Online orders now leave a real trail: processing a
// catalog-linked order creates an invoice and takes stock; cancelling voids it.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('online order fulfilment creates and voids real invoices', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const stockOf = async (productId: string) => (await api(page, 'GET', `/api/inventory/${outletId}`)).json.inventory.find((i: { product_id: string }) => i.product_id === productId).quantity_on_hand as number
  const item = (await api(page, 'GET', `/api/inventory/${outletId}`)).json.inventory.find((i: { quantity_on_hand: number }) => i.quantity_on_hand > 5)
  const tag = `E2E-ONL-${Date.now()}`
  const linked = { product_id: item.product_id, name: item.name, quantity: 1, price: item.unit_price }
  const before = await stockOf(item.product_id)

  // 1. Prepaid marketplace order: invoice created + settled, stock -1, courier saved.
  const o1 = await api(page, 'POST', '/api/online-orders', { outlet_id: outletId, channel: 'marketplace', customer_name: `${tag}-1`, customer_phone: '081200000002', items: [linked], payment_method: 'bank_transfer', payment_status: 'paid', shipping_fee: 5000, external_ref: 'MP-123' })
  expect(o1.status).toBe(201)
  expect(o1.json.order.total_amount).toBe(item.unit_price + 5000)
  expect((await api(page, 'PATCH', `/api/online-orders/${o1.json.order.id}/status`, { status: 'completed' })).status).toBe(400) // cannot skip steps

  const p1 = await api(page, 'PATCH', `/api/online-orders/${o1.json.order.id}/status`, { status: 'on_process' })
  expect(p1.status).toBe(200)
  expect(p1.json.invoice_id).toBeTruthy()
  expect(await stockOf(item.product_id)).toBe(before - 1)
  const inv = await api(page, 'GET', `/api/invoices/${p1.json.invoice_id}`)
  expect(inv.json.invoice.payment_status).toBe('paid')

  const d1 = await api(page, 'PATCH', `/api/online-orders/${o1.json.order.id}/status`, { status: 'on_delivery', courier: 'JNE', tracking_number: 'RESI123' })
  expect(d1.json.order).toMatchObject({ courier: 'JNE', tracking_number: 'RESI123' })
  expect((await api(page, 'PATCH', `/api/online-orders/${o1.json.order.id}/status`, { status: 'completed' })).status).toBe(200)

  // 2. Free-text order moves on but is flagged as not stocked.
  const o2 = await api(page, 'POST', '/api/online-orders', { outlet_id: outletId, channel: 'whatsapp', customer_name: `${tag}-2`, items: [{ name: 'Item bebas', quantity: 1, price: 10000 }] })
  const p2 = await api(page, 'PATCH', `/api/online-orders/${o2.json.order.id}/status`, { status: 'on_process' })
  expect(p2.status).toBe(200)
  expect(p2.json.invoice_id).toBeNull()
  expect(p2.json.note).toContain('tanpa produk')
  await api(page, 'PATCH', `/api/online-orders/${o2.json.order.id}/status`, { status: 'cancelled', reason: 'E2E' })

  // 3. COD order: pending invoice; cancelling voids it and returns the stock.
  const o3 = await api(page, 'POST', '/api/online-orders', { outlet_id: outletId, channel: 'instagram', customer_name: `${tag}-3`, items: [linked], payment_method: 'cod' })
  const p3 = await api(page, 'PATCH', `/api/online-orders/${o3.json.order.id}/status`, { status: 'on_process' })
  expect((await api(page, 'GET', `/api/invoices/${p3.json.invoice_id}`)).json.invoice.payment_status).toBe('pending')
  expect(await stockOf(item.product_id)).toBe(before - 2)
  const c3 = await api(page, 'PATCH', `/api/online-orders/${o3.json.order.id}/status`, { status: 'cancelled', reason: 'pelanggan tidak di tempat' })
  expect(c3.status).toBe(200)
  expect(c3.json.order.cancel_reason).toBe('pelanggan tidak di tempat')
  expect((await api(page, 'GET', `/api/invoices/${p3.json.invoice_id}`)).json.invoice.order_status).toBe('voided')
  expect(await stockOf(item.product_id)).toBe(before - 1)
  expect((await api(page, 'PATCH', `/api/online-orders/${o3.json.order.id}`, { notes: 'x' })).status).toBe(409) // closed orders are read-only

  // Clean up order 1's sale (voids it and restores the last unit).
  expect((await api(page, 'POST', `/api/invoices/${p1.json.invoice_id}/void`, { reason: 'E2E online order cleanup' })).status).toBe(200)
  expect(await stockOf(item.product_id)).toBe(before)
})
