import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Needs migration 066. Moving-average cost (receipt moves it, sale COGS uses
// it), bin location, and the serial registry.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

const EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

test.describe('Inventory costing, bins, serials', () => {
  test.setTimeout(300_000)

  test('a priced receipt moves the average cost and the next sale uses it for COGS', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
    const list = await api(page, 'GET', `/api/inventory/${outletId}?analytics=1`)
    const item = list.json.inventory.find((i: { quantity_on_hand: number; purchase_price: number; supplier_id: string | null }) => i.quantity_on_hand > 5 && i.purchase_price > 0)
    const supplierId: string = item.supplier_id ?? (await api(page, 'GET', '/api/suppliers')).json.suppliers[0].id
    const oldAvg: number = item.avg_cost ?? item.purchase_price
    const receiptCost = item.purchase_price * 3 + 1000

    const po = await api(page, 'POST', '/api/purchase-orders', { outlet_id: outletId, supplier_id: supplierId, items: [{ product_id: item.product_id, quantity: 10, unit_cost: receiptCost }] })
    expect(po.status).toBe(201)
    const poId = po.json.purchase_order?.id ?? po.json.po_id ?? po.json.id
    await api(page, 'POST', `/api/purchase-orders/${poId}/submit`)
    expect((await api(page, 'POST', `/api/purchase-orders/${poId}/approve`)).status).toBe(200)
    const detail = await api(page, 'GET', `/api/purchase-orders/${poId}`)
    const poItem = (detail.json.items ?? detail.json.po_items)[0]
    expect((await api(page, 'POST', `/api/purchase-orders/${poId}/receive`, { items: [{ po_item_id: poItem.id, quantity_received: 10 }] })).status).toBe(200)

    const after = await api(page, 'GET', `/api/inventory/${outletId}?analytics=1`)
    const updated = after.json.inventory.find((i: { product_id: string }) => i.product_id === item.product_id)
    const expected = (item.quantity_on_hand * oldAvg + 10 * receiptCost) / (item.quantity_on_hand + 10)
    expect(updated.avg_cost).toBeCloseTo(expected, 1)
    expect(updated.quantity_on_hand).toBe(item.quantity_on_hand + 10)

    // A sale now books COGS at the moving average, not the master price.
    const sale = await api(page, 'POST', '/api/invoices', { outlet_id: outletId, items: [{ product_id: item.product_id, quantity: 1 }], payment_method: 'cash' })
    expect(sale.status).toBe(201)
    const invoice = await api(page, 'GET', `/api/invoices/${sale.json.invoice_id}`)
    expect(invoice.json.items[0].cost_of_goods_sold).toBeCloseTo(updated.avg_cost, 1)
    await api(page, 'POST', `/api/invoices/${sale.json.invoice_id}/void`, { reason: 'E2E costing cleanup' })
    // Take the received units back out (adjustments never move the average).
    await api(page, 'POST', '/api/inventory/adjust', { outlet_id: outletId, product_id: item.product_id, quantity_change: -10, reason: 'E2E costing cleanup' })
  })

  test('bin location and serial registry', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
    const item = (await api(page, 'GET', `/api/inventory/${outletId}`)).json.inventory[0]

    expect((await api(page, 'PATCH', '/api/inventory/reorder-level', { outlet_id: outletId, product_id: item.product_id, bin_location: 'E2E-A1' })).status).toBe(200)
    const withBin = (await api(page, 'GET', `/api/inventory/${outletId}`)).json.inventory.find((i: { product_id: string }) => i.product_id === item.product_id)
    expect(withBin.bin_location).toBe('E2E-A1')
    await api(page, 'PATCH', '/api/inventory/reorder-level', { outlet_id: outletId, product_id: item.product_id, bin_location: '' })

    const tag = `E2E-${Date.now()}`
    const created = await api(page, 'POST', '/api/inventory/serials', { outlet_id: outletId, product_id: item.product_id, serials: [`${tag}-1`, `${tag}-2`, `${tag}-1`] })
    expect(created.status).toBe(201)
    expect(created.json.created).toBe(2)
    const again = await api(page, 'POST', '/api/inventory/serials', { outlet_id: outletId, product_id: item.product_id, serials: [`${tag}-1`] })
    expect(again.json.created).toBe(0)
    expect(again.json.duplicates).toContain(`${tag}-1`)

    const found = await api(page, 'GET', `/api/inventory/serials?outlet_id=${outletId}&search=${tag}`)
    expect(found.json.serials).toHaveLength(2)
    const [a, b] = found.json.serials
    expect((await api(page, 'PATCH', '/api/inventory/serials', { id: a.id, status: 'sold' })).status).toBe(200)
    expect((await api(page, 'DELETE', `/api/inventory/serials?id=${a.id}`)).status).toBe(409)
    expect((await api(page, 'DELETE', `/api/inventory/serials?id=${b.id}`)).status).toBe(200)
    await api(page, 'PATCH', '/api/inventory/serials', { id: a.id, status: 'in_stock' })
    expect((await api(page, 'DELETE', `/api/inventory/serials?id=${a.id}`)).status).toBe(200)
  })
})
