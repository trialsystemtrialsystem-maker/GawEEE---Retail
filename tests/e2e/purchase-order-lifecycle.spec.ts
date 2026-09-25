import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// PO lifecycle: guards on receiving (status + over-receipt), partial receipts
// with history, cancel rules, and the detail page. Receives at the item's
// current cost so the moving average is unchanged, then takes the stock back out.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('purchase order lifecycle', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const inv = await api(page, 'GET', `/api/inventory/${outletId}`)
  const item = inv.json.inventory.find((i: { quantity_on_hand: number; purchase_price: number; supplier_id: string | null }) => i.quantity_on_hand > 5 && i.purchase_price > 0)
  const supplierId: string = item.supplier_id ?? (await api(page, 'GET', '/api/suppliers')).json.suppliers[0].id
  const cost = item.avg_cost ?? item.purchase_price
  const line = { product_id: item.product_id, quantity: 10, unit_cost: cost }

  // A draft cannot take goods; a draft can be cancelled with a reason.
  const draft = await api(page, 'POST', '/api/purchase-orders', { outlet_id: outletId, supplier_id: supplierId, items: [line] })
  expect(draft.status).toBe(201)
  const draftId: string = draft.json.po_id
  const draftItems = (await api(page, 'GET', `/api/purchase-orders/${draftId}`)).json.items
  expect((await api(page, 'POST', `/api/purchase-orders/${draftId}/receive`, { items: [{ po_item_id: draftItems[0].id, quantity_received: 1 }] })).status).toBe(409)
  expect((await api(page, 'POST', `/api/purchase-orders/${draftId}/cancel`, { reason: 'x' })).status).toBe(400)
  expect((await api(page, 'POST', `/api/purchase-orders/${draftId}/cancel`, { reason: 'E2E batal' })).status).toBe(200)

  // Full path with a partial delivery first.
  const created = await api(page, 'POST', '/api/purchase-orders', { outlet_id: outletId, supplier_id: supplierId, items: [line] })
  const id: string = created.json.po_id
  await api(page, 'POST', `/api/purchase-orders/${id}/submit`)
  expect((await api(page, 'POST', `/api/purchase-orders/${id}/approve`)).status).toBe(200)
  const poItem = (await api(page, 'GET', `/api/purchase-orders/${id}`)).json.items[0]

  expect((await api(page, 'POST', `/api/purchase-orders/${id}/receive`, { items: [{ po_item_id: poItem.id, quantity_received: 11 }] })).status).toBe(400)
  const partial = await api(page, 'POST', `/api/purchase-orders/${id}/receive`, { items: [{ po_item_id: poItem.id, quantity_received: 4, batch_number: 'E2E-B1' }] })
  expect(partial.status).toBe(200)
  expect(partial.json.po_status).toBe('partial_received')
  expect((await api(page, 'POST', `/api/purchase-orders/${id}/cancel`, { reason: 'sudah diterima sebagian' })).status).toBe(409)

  const receipts = await api(page, 'GET', `/api/purchase-orders/${id}/receipts`)
  expect(receipts.json.receipts).toHaveLength(1)
  expect(receipts.json.receipts[0]).toMatchObject({ quantity: 4, batch_number: 'E2E-B1' })

  const rest = await api(page, 'POST', `/api/purchase-orders/${id}/receive`, { items: [{ po_item_id: poItem.id, quantity_received: 6 }] })
  expect(rest.json.po_status).toBe('received')
  expect((await api(page, 'POST', `/api/purchase-orders/${id}/receive`, { items: [{ po_item_id: poItem.id, quantity_received: 1 }] })).status).toBe(409)

  await page.goto(`/dashboard/suppliers/purchase-orders/${id}`)
  await expect(page.getByRole('button', { name: 'Cetak PO' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Riwayat Penerimaan')).toBeVisible()

  await api(page, 'POST', '/api/inventory/adjust', { outlet_id: outletId, product_id: item.product_id, quantity_change: -10, reason: 'E2E PO cleanup' })
})
