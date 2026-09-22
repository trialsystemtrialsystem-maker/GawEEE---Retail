import { test, expect } from '@playwright/test'
import { login, currentOutletId, pickInStockProduct, addProductToCart, voidNow } from './helpers'

// Regression coverage for split payment (todo.md Phase 11) — a sale paid
// across up to 2 methods at once (at most 1 non-cash, see
// components/pos/SplitPaymentEditor.tsx's comment on why), previously only
// verified with a manual live pass when it shipped and never since. Splits
// a real sale across cash + e-wallet, settles the pending e-wallet portion,
// and checks the money actually reconciles: payment_transactions sums to
// the invoice total and payment_status lands on 'paid'.
const MANAGER_EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const MANAGER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

test.describe('Split payment', () => {
  test.setTimeout(60_000)

  test('cash + e-wallet split settles with payments summing to the invoice total', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/pos')

    const outletId = await currentOutletId(page)
    const product = await pickInStockProduct(page, outletId)
    await addProductToCart(page, product.name)
    await expect(page.locator('text=Keranjang (1 item)')).toBeVisible()

    const checkoutButton = page.getByRole('button', { name: 'Proses Pembayaran' })
    // The button's own label includes the live cart total, e.g.
    // "Proses Pembayaran · Rp 38.000" — read it off there rather than
    // recomputing the total client-side (taxes/discounts/rounding are the
    // server's job, not this test's).
    const buttonText = await checkoutButton.innerText()
    const total = Number(buttonText.replace(/[^0-9]/g, ''))
    if (!total) throw new Error(`E2E setup: could not parse cart total from "${buttonText}"`)

    await page.getByRole('button', { name: '+ Bayar dengan beberapa metode' }).click()
    const addMethodButton = page.getByRole('button', { name: '+ Tambah Metode' })
    await addMethodButton.click() // first line defaults to cash = full total
    await addMethodButton.click() // second line defaults to e_wallet = 0

    const cashPortion = Math.floor(total / 2)
    const ewalletPortion = total - cashPortion
    const amountInputs = page.locator('input[type="number"]')
    await amountInputs.nth(0).fill(String(cashPortion))
    await amountInputs.nth(1).fill(String(ewalletPortion))
    await expect(page.locator('text=Sisa Bayar')).toBeVisible()

    const [invoiceResponse, initiateResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/invoices') && res.request().method() === 'POST'),
      page.waitForResponse((res) => res.url().includes('/api/payments/initiate') && res.request().method() === 'POST'),
      checkoutButton.click(),
    ])
    const invoiceId = (await invoiceResponse.json()).invoice_id as string
    const initiateBody = await initiateResponse.json()
    type PaymentLine = { status: string; payment_method: string; payment_id: string }
    const pendingLine = (initiateBody.payments as PaymentLine[]).find((p) => p.status === 'pending')
    if (!pendingLine) throw new Error('E2E setup: e-wallet split line did not come back pending')

    // Settle the pending e-wallet portion (the cash portion settles
    // immediately server-side — see /api/payments/initiate).
    await page.evaluate(async (id) => {
      await fetch(`/api/payments/${id}/simulate-success`, { method: 'POST' })
    }, pendingLine.payment_id)

    const invoiceDetail = await page.evaluate(async (id) => {
      const res = await fetch(`/api/invoices/${id}`)
      return res.json()
    }, invoiceId)
    expect(invoiceDetail.invoice.payment_status).toBe('paid')
    type PaymentRow = { amount: number; status: string }
    const paidSum = (invoiceDetail.payments as PaymentRow[]).reduce((sum, p) => sum + p.amount, 0)
    expect(paidSum).toBe(total)
    expect(invoiceDetail.payments).toHaveLength(2)

    // Cleanup — void the test invoice so repeated runs don't leave junk
    // paid invoices or drain the product's stock.
    await voidNow(page, invoiceId, 'Pembersihan data uji regresi otomatis')
  })
})
