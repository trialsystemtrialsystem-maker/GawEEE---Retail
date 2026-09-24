import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Inventory depth: analytics on the stock list, kartu stok with a running
// balance, adjustment journals, the multi-outlet overview, and the new pages.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test.describe('Inventory depth', () => {
  test.setTimeout(240_000)

  test('analytics, kartu stok running balance and adjustment journal', async ({ page }) => {
    await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
    const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id

    const list = await api(page, 'GET', `/api/inventory/${outletId}?analytics=1`)
    expect(list.status).toBe(200)
    expect(list.json.summary.sku_count).toBeGreaterThan(0)
    const item = list.json.inventory.find((i: { quantity_on_hand: number; purchase_price: number }) => i.quantity_on_hand > 5 && i.purchase_price > 0)
    expect(item).toMatchObject({ abc_class: expect.stringMatching(/[ABC]/), health: expect.any(String) })
    expect(typeof item.suggested_reorder).toBe('number')

    // The default (POS) call skips the heavy sales scan but still returns stock.
    const light = await api(page, 'GET', `/api/inventory/${outletId}`)
    expect(light.json.inventory[0].sold_30d).toBe(0)

    // +2 then -2 leaves stock unchanged; both must show in the card with balances.
    const before = item.quantity_on_hand
    expect((await api(page, 'POST', '/api/inventory/adjust', { outlet_id: outletId, product_id: item.product_id, quantity_change: 2, reason: 'E2E kartu stok' })).status).toBe(200)
    expect((await api(page, 'POST', '/api/inventory/adjust', { outlet_id: outletId, product_id: item.product_id, quantity_change: -2, reason: 'E2E kartu stok balik' })).status).toBe(200)

    const card = await api(page, 'GET', `/api/inventory/ledger?outlet_id=${outletId}&product_id=${item.product_id}&type=adjustment`)
    expect(card.status).toBe(200)
    const [newest, second] = card.json.entries
    expect(newest.quantity_change).toBe(-2)
    expect(second.quantity_change).toBe(2)
    expect(newest.balance).toBe(before)
    expect(second.balance).toBe(before + 2)

    // A per-outlet reorder point re-evaluates the alert immediately, then restore.
    const lvl = await api(page, 'PATCH', '/api/inventory/reorder-level', { outlet_id: outletId, product_id: item.product_id, reorder_level: before + 1000 })
    expect(lvl.json.alert_status).toBe('low_stock')
    const restored = await api(page, 'PATCH', '/api/inventory/reorder-level', { outlet_id: outletId, product_id: item.product_id, reorder_level: item.reorder_level })
    expect(restored.status).toBe(200)

    // The adjustment reached the books.
    const today = new Date().toISOString().slice(0, 10)
    const journals = await api(page, 'GET', `/api/accounting/journal-entries?outlet_id=${outletId}&start=${today}`)
    expect(journals.json.entries.some((e: { source_type: string }) => e.source_type === 'stock_adjustment')).toBe(true)
  })

  test('multi-outlet overview and new pages render', async ({ page }) => {
    await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
    const overview = await api(page, 'GET', '/api/inventory/overview')
    expect(overview.status).toBe(200)
    expect(overview.json.outlets.length).toBeGreaterThan(0)
    expect(overview.json.products[0].stocks.length).toBeGreaterThan(0)

    for (const [path, heading] of [
      ['/dashboard/inventory', 'Stok Barang'],
      ['/dashboard/inventory/stock-card', 'Kartu Stok'],
      ['/dashboard/inventory/reorder', 'Rekomendasi Pemesanan'],
      ['/dashboard/inventory/valuation', 'Nilai Persediaan & Analisis'],
      ['/dashboard/inventory/overview', 'Stok Semua Outlet'],
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 60_000 })
    }
  })
})
