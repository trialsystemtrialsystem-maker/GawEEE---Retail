import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Catalog v2: safe edits, bulk price rules with preview-by-default, CSV import
// with dry-run, soft-deleted products hidden. The price-history test needs
// migration 070.
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

test.describe('Product catalog', () => {
  test.setTimeout(300_000)

  test('create, safe edit, bulk price rule, import, soft delete', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const tag = `E2E${Date.now()}`
    const ids: string[] = []
    const base = { unit_type: 'pcs', reorder_level: 1, reorder_quantity: 1 }

    const created = await api(page, 'POST', '/api/products', { sku: `${tag}-A`, name: `Produk ${tag} A`, purchase_price: 7000, selling_price: 10000, ...base })
    expect(created.status).toBe(201)
    const id: string = created.json.product.id
    ids.push(id)
    expect((await api(page, 'POST', '/api/products', { sku: `${tag}-a`, name: 'Duplikat', purchase_price: 1, selling_price: 2, ...base })).status).toBe(409)

    // Edits are whitelisted: a body that only tries to move the row is rejected, real edits work.
    expect((await api(page, 'PUT', `/api/products/${id}`, { company_id: '00000000-0000-0000-0000-000000000000' })).status).toBe(400)
    expect((await api(page, 'PUT', `/api/products/${id}`, { selling_price: 12000, name: `Produk ${tag} A2` })).status).toBe(200)

    // Bulk price: preview is the default and changes nothing.
    const preview = await api(page, 'POST', '/api/products/bulk-price', { product_ids: [id], rule: { mode: 'percent', value: 10 } })
    expect(preview.json.dry_run).toBe(true)
    expect(preview.json.changes[0].new.selling_price).toBe(13200)
    expect((await api(page, 'GET', `/api/products/${id}`)).json.product.selling_price).toBe(12000)

    const below = await api(page, 'POST', '/api/products/bulk-price', { product_ids: [id], rule: { mode: 'set', value: 5000 } })
    expect(below.json.summary.below_cost).toBe(1)

    const applied = await api(page, 'POST', '/api/products/bulk-price', { product_ids: [id], rule: { mode: 'margin', value: 30 }, round: 500, dry_run: false })
    expect(applied.status).toBe(200)
    expect((await api(page, 'GET', `/api/products/${id}`)).json.product.selling_price).toBe(10000) // 7000 / 0.7

    // Import: dry-run reports create/update/error; a file with an error is refused.
    const rows = [
      { sku: `${tag}-A`, selling_price: 11000 },
      { sku: `${tag}-B`, name: `Produk ${tag} B`, category: `E2E Kategori`, purchase_price: 500, selling_price: 900 },
      { sku: `${tag}-C`, name: 'tanpa harga' },
    ]
    const dry = await api(page, 'POST', '/api/products/import', { rows })
    expect(dry.json.summary).toMatchObject({ create: 1, update: 1, errors: 1 })
    expect((await api(page, 'POST', '/api/products/import', { rows, dry_run: false })).status).toBe(400)

    const good = rows.slice(0, 2)
    const run = await api(page, 'POST', '/api/products/import', { rows: good, dry_run: false })
    expect(run.status).toBe(200)
    expect((await api(page, 'GET', `/api/products/${id}`)).json.product.selling_price).toBe(11000)
    const listed = await api(page, 'GET', `/api/products?search=${tag}-B`)
    expect(listed.json.data).toHaveLength(1)
    ids.push(listed.json.data[0].id)
    expect(listed.json.summary.total).toBeGreaterThan(0)

    // Soft-deleted products drop out of the catalog.
    for (const pid of ids) expect((await api(page, 'DELETE', `/api/products/${pid}`)).status).toBe(200)
    expect((await api(page, 'GET', `/api/products?search=${tag}`)).json.data).toHaveLength(0)
  })

  test('price history is recorded (needs migration 070)', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const tag = `E2EH${Date.now()}`
    const created = await api(page, 'POST', '/api/products', { sku: tag, name: `Riwayat ${tag}`, purchase_price: 100, selling_price: 200, unit_type: 'pcs', reorder_level: 1, reorder_quantity: 1 })
    const id: string = created.json.product.id
    try {
      await api(page, 'PUT', `/api/products/${id}`, { selling_price: 250 })
      await api(page, 'PUT', `/api/products/${id}`, { purchase_price: 120, selling_price: 260 })
      await api(page, 'PUT', `/api/products/${id}`, { name: 'nama saja' }) // no price change -> no history row
      const h = await api(page, 'GET', `/api/products/${id}/history`)
      expect(h.status).toBe(200)
      expect(h.json.changes).toHaveLength(2)
      expect(h.json.changes[0]).toMatchObject({ old_selling_price: 250, new_selling_price: 260, old_purchase_price: 100, new_purchase_price: 120 })
    } finally {
      await api(page, 'DELETE', `/api/products/${id}`)
    }
  })
})
