import { test, expect, type Page, type Browser } from '@playwright/test'
import { login, currentOutletId, pickInStockProduct } from './helpers'

// Server-side discount integrity: POST /api/invoices must not trust the
// discount total the browser sends.
const EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

async function post(page: Page, body: unknown) {
  return page.evaluate(async (body) => {
    const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: res.status, json: await res.json().catch(() => ({})) }
  }, body)
}

test('discounts are validated server-side', async ({ page, browser }: { page: Page; browser: Browser }) => {
  test.setTimeout(120_000)
  await login(page, EMAIL, PASSWORD)
  const outletId = await currentOutletId(page)
  const product = await pickInStockProduct(page, outletId)
  const detail = await page.evaluate(async (id) => (await fetch(`/api/products/${id}`)).json(), product.product_id)
  const price: number = detail.product?.selling_price ?? detail.selling_price
  const base = { outlet_id: outletId, items: [{ product_id: product.product_id, quantity: 1 }], payment_method: 'cash' }
  const created: string[] = []

  // Manager: a discount above the subtotal is refused.
  expect((await post(page, { ...base, discount_amount: price * 2 })).status).toBe(400)
  // A promo claim with no promotion behind it is refused.
  const fakePromo = await post(page, { ...base, discount_amount: 1, promotion_id: '00000000-0000-4000-8000-000000000000', promotion_discount_amount: 1 })
  expect(fakePromo.status).toBe(400)
  // Redeeming points with no customer is refused.
  expect((await post(page, { ...base, discount_amount: 1, redeem_points: 5, redeem_discount_amount: 1 })).status).toBe(400)

  // A modest manager discount within the subtotal is accepted.
  const ok = await post(page, { ...base, discount_amount: Math.floor(price / 10) })
  expect(ok.status).toBe(201)
  created.push(ok.json.invoice_id)

  // Cashier: a large unexplained discount is refused, a small one passes.
  const email = `e2e-disc-${Date.now()}@gaweee.test`
  const made = await page.evaluate(async ({ email, outletId }) => {
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, full_name: 'E2E Disc (temp)', role: 'cashier', outlet_id: outletId }) })
    return { status: res.status, body: await res.json() }
  }, { email, outletId })
  expect(made.status).toBe(201)
  const ctx = await browser.newContext()
  const cashier = await ctx.newPage()
  try {
    await login(cashier, email, made.body.temp_password)
    expect((await post(cashier, { ...base, discount_amount: Math.ceil(price * 0.6) })).status).toBe(400)
    const small = await post(cashier, { ...base, discount_amount: Math.floor(price * 0.1) })
    expect(small.status).toBe(201)
    created.push(small.json.invoice_id)
  } finally {
    await ctx.close()
    for (const id of created) {
      await page.evaluate(async (id) => {
        await fetch(`/api/invoices/${id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Pembersihan uji diskon otomatis' }) })
      }, id)
    }
    await page.evaluate(async (id) => { await fetch(`/api/admin/users/${id}`, { method: 'DELETE' }) }, made.body.user_id)
  }
})
