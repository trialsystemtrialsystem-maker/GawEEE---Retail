import { test, expect } from '@playwright/test'
import { login, currentOutletId, pickInStockProduct, addProductToCart, voidNow } from './helpers'

// Regression coverage for the guard added in todo.md Phase 24: a manager can
// void a sale within 24h while its e-wallet/bank-transfer payment is still
// pending settlement. Without the check in
// app/api/payments/[paymentId]/simulate-success/route.ts, confirming that
// stale payment afterward (a real gateway webhook arriving late, once
// Doku/Bank VA are connected — simulate-success is today's demo stand-in for
// exactly that webhook) would flip a *voided* invoice's payment_status back
// to 'paid' and award loyalty points for a sale that officially no longer
// exists. Phase 24 verified this manually once, live; this makes it a
// permanent, repeatable regression check instead.
const MANAGER_EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const MANAGER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

test.describe('Void vs. pending-settlement race guard', () => {
  test.setTimeout(60_000)

  test('voiding a sale with a pending e-wallet payment blocks its late settlement', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/pos')

    const outletId = await currentOutletId(page)
    const product = await pickInStockProduct(page, outletId)
    await addProductToCart(page, product.name)
    await expect(page.locator('text=Keranjang (1 item)')).toBeVisible()

    // The radio itself is visually hidden (sr-only) — the visible icon/label
    // sits over it, so a normal actionability-checked click intercepts on
    // that icon. force:true clicks at the input's coordinates directly,
    // matching how a real click-through-the-label toggle actually works.
    await page.getByRole('radio', { name: 'E-Wallet' }).check({ force: true })

    const [invoiceResponse, initiateResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/invoices') && res.request().method() === 'POST'),
      page.waitForResponse((res) => res.url().includes('/api/payments/initiate') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Proses Pembayaran' }).click(),
    ])
    const invoiceId = (await invoiceResponse.json()).invoice_id as string
    const initiateBody = await initiateResponse.json()
    type PendingLine = { status: string; payment_method: string; payment_id: string }
    const pendingLine = (initiateBody.payments as PendingLine[]).find((p) => p.status === 'pending')
    if (!pendingLine) throw new Error('E2E setup: e-wallet payment did not come back pending')
    const paymentId = pendingLine.payment_id

    // On the QR screen now — deliberately do NOT click "Simulasikan
    // Pembayaran Berhasil". Void the sale first, simulating a manager
    // cancelling it while the customer's e-wallet payment is still in flight.
    await expect(page.locator('text=Pembayaran E-Wallet')).toBeVisible()
    await voidNow(page, invoiceId, 'Pelanggan batal, dompet digital belum settle (uji regresi otomatis)')

    // The late "webhook" (simulate-success stands in for Doku/Bank VA's real
    // one) must be rejected, not silently flip the voided invoice back to paid.
    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/payments/${id}/simulate-success`, { method: 'POST' })
      return { status: res.status, body: await res.json() }
    }, paymentId)
    expect(result.status).toBe(409)
    expect(result.body.error).toBe('Invoice ini sudah dibatalkan')

    // And the invoice itself must still show pending, not paid.
    const invoiceAfter = await page.evaluate(async (id) => {
      const res = await fetch(`/api/invoices/${id}`)
      return res.json()
    }, invoiceId)
    expect(invoiceAfter.invoice.payment_status).toBe('pending')
    expect(invoiceAfter.invoice.order_status).toBe('voided')
  })
})
