import { test, expect, type Page } from '@playwright/test'
import { login, currentOutletId, pickInStockProduct } from './helpers'

// Promotion / coupon rules (migration 071): validation, edit, minimum
// purchase, max-discount cap, coupon use consumed at sale and returned on void.
const EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('promo and coupon rules are enforced', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, EMAIL, PASSWORD)
  const outletId = await currentOutletId(page)
  const product = await pickInStockProduct(page, outletId)
  const detail = await api(page, 'GET', `/api/products/${product.product_id}`)
  const price: number = detail.json.product?.selling_price ?? detail.json.selling_price
  const tag = Date.now().toString(36).toUpperCase()
  const day = new Date().toISOString().slice(0, 10)
  const base = { outlet_id: outletId, discount_type: 'percentage', discount_value: 50, start_date: day, end_date: day }
  const invoices: string[] = []

  // Validation
  expect((await api(page, 'POST', '/api/promotions', { ...base, name: 'x', end_date: '2000-01-01' })).status).toBe(400)
  expect((await api(page, 'POST', '/api/promotions', { ...base, name: 'x', discount_value: 150 })).status).toBe(400)

  // Promo needing a bigger basket than we will buy: guard refuses it.
  const promo = await api(page, 'POST', '/api/promotions', { ...base, name: `E2E min ${tag}`, min_purchase: price * 100 })
  expect(promo.status).toBe(201)
  const promoId: string = promo.json.promotion.id
  const items = [{ product_id: product.product_id, quantity: 1 }]
  const sale = { outlet_id: outletId, items, payment_method: 'cash' }
  const tooSmall = await api(page, 'POST', '/api/invoices', { ...sale, discount_amount: 1, promotion_id: promoId, promotion_discount_amount: 1 })
  expect(tooSmall.status).toBe(400)

  // Edit: drop the minimum and cap the discount; a 50% promo is then held to the cap.
  const cap = Math.max(1, Math.floor(price / 10))
  const edited = await api(page, 'PUT', `/api/promotions/${promoId}`, { ...base, name: `E2E min ${tag}`, min_purchase: 0, max_discount: cap })
  expect(edited.status).toBe(200)
  expect(edited.json.promotion.max_discount).toBe(cap)
  expect((await api(page, 'POST', '/api/invoices', { ...sale, discount_amount: price / 2, promotion_id: promoId, promotion_discount_amount: price / 2 })).status).toBe(400)
  const okPromo = await api(page, 'POST', '/api/invoices', { ...sale, discount_amount: cap, promotion_id: promoId, promotion_discount_amount: cap })
  expect(okPromo.status).toBe(201)
  invoices.push(okPromo.json.invoice_id)
  const listed = (await api(page, 'GET', `/api/promotions?outlet_id=${outletId}`)).json.promotions.find((p: { id: string }) => p.id === promoId)
  expect(listed.uses).toBe(1)
  expect(listed.total_discount).toBe(cap)

  // Coupon: validation does not consume a use, the sale does, void returns it.
  const code = `E2E${tag}`
  const coupon = await api(page, 'POST', '/api/coupons', { outlet_id: outletId, code: code.toLowerCase(), discount_type: 'fixed', discount_value: cap, usage_limit: 1 })
  expect(coupon.status).toBe(201)
  expect(coupon.json.coupon.code).toBe(code)
  const couponId: string = coupon.json.coupon.id
  const usage = async () => (await api(page, 'GET', `/api/coupons?outlet_id=${outletId}`)).json.coupons.find((c: { id: string }) => c.id === couponId).usage_count
  const check = await api(page, 'POST', '/api/coupons/redeem', { outlet_id: outletId, code, subtotal: price })
  expect(check.status).toBe(200)
  expect(check.json.amount).toBe(cap)
  expect(await usage()).toBe(0)

  const withCoupon = await api(page, 'POST', '/api/invoices', { ...sale, discount_amount: cap, coupon_code: code, coupon_discount_amount: cap })
  expect(withCoupon.status).toBe(201)
  invoices.push(withCoupon.json.invoice_id)
  expect(await usage()).toBe(1)
  // Limit reached: both the validator and the invoice guard refuse it.
  expect((await api(page, 'POST', '/api/coupons/redeem', { outlet_id: outletId, code, subtotal: price })).status).toBe(400)
  expect((await api(page, 'POST', '/api/invoices', { ...sale, discount_amount: cap, coupon_code: code, coupon_discount_amount: cap })).status).toBe(400)
  // Lowering the limit under current use is refused; voiding gives the use back.
  expect((await api(page, 'PUT', `/api/coupons/${couponId}`, { outlet_id: outletId, code, discount_type: 'fixed', discount_value: cap, usage_limit: 1, min_purchase: 0 })).status).toBe(200)
  await api(page, 'POST', `/api/invoices/${withCoupon.json.invoice_id}/void`, { reason: 'Pembersihan uji kupon otomatis' })
  expect(await usage()).toBe(0)

  for (const id of invoices.slice(0, 1)) await api(page, 'POST', `/api/invoices/${id}/void`, { reason: 'Pembersihan uji promo otomatis' })
  await api(page, 'PATCH', `/api/promotions/${promoId}`, { is_active: false })
  await api(page, 'PATCH', `/api/coupons/${couponId}`, { is_active: false })
})
