import { test, expect } from '@playwright/test'
import { login, createCashSale } from './helpers'

// Regression coverage for the customer refund/return flow
// (app/api/customer-refunds — draft-then-submit, same pattern as
// expense_requests) — another real money-and-stock-movement path with no
// prior e2e coverage. Refunds the single item from a freshly created paid
// sale and checks the stock actually comes back, the same way the void
// tests check void_invoice()'s stock restoration.
const MANAGER_EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const MANAGER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

test.describe('Customer refund', () => {
  test.setTimeout(60_000)

  test('refunding a paid item restores its stock', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    const invoiceId = await createCashSale(page)

    const invoiceDetail = await page.evaluate(async (id) => {
      const res = await fetch(`/api/invoices/${id}`)
      return res.json()
    }, invoiceId)
    const item = invoiceDetail.items[0]
    const outletId = invoiceDetail.invoice.outlet_id

    async function quantityOnHand() {
      const data = await page.evaluate(async (productId) => {
        const res = await fetch(`/api/products/${productId}`)
        return res.json()
      }, item.product_id)
      type InventoryRow = { outlet_id: string; quantity_on_hand: number }
      return (data.inventory_by_outlet as InventoryRow[]).find((i) => i.outlet_id === outletId)?.quantity_on_hand ?? 0
    }

    const beforeQty = await quantityOnHand()

    await page.goto(`/dashboard/sales/${invoiceId}`)
    await page.getByRole('button', { name: '+ Buat Refund' }).click()
    await page.locator('input[type="number"]').first().fill(String(item.quantity))
    await page.getByPlaceholder('mis. Produk rusak').fill('Produk rusak (uji regresi otomatis)')

    const [submitResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/customer-refunds/') && res.url().endsWith('/submit') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Proses Refund' }).click(),
    ])
    expect(submitResponse.ok()).toBe(true)
    await expect(page.locator('text=Refund berhasil diproses')).toBeVisible()

    const afterQty = await quantityOnHand()
    expect(afterQty).toBe(beforeQty + item.quantity)
  })
})
