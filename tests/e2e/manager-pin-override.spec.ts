import { test, expect, type Page } from '@playwright/test'
import { login, currentOutletId, pickInStockProduct } from './helpers'

// Manager PIN override: a discount above the cashier cap is refused, a
// manager's PIN (staff_members.pin_code) raises it for that one sale, a
// wrong PIN is refused, and the approving manager is stamped on the invoice.
const EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'
const PIN = '135790'

async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('manager PIN raises the cashier discount cap', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await login(page, EMAIL, PASSWORD)
  const outletId = await currentOutletId(page)
  const product = await pickInStockProduct(page, outletId)
  const detail = await api(page, 'GET', `/api/products/${product.product_id}`)
  const price: number = detail.json.product?.selling_price ?? detail.json.selling_price

  const me = (await api(page, 'GET', '/api/admin/users?role=master_admin')).json.users
  const manager = me.find((u: { outlet_id: string | null }) => u.outlet_id === outletId) ?? me[0]

  const staff = await api(page, 'POST', '/api/staff', {
    outlet_id: outletId,
    first_name: 'E2E Manager PIN',
    position: 'Manager',
    hire_date: '2020-01-01',
    email: manager.email,
    pin_code: PIN,
  })
  expect(staff.status).toBe(201)
  const staffId: string = staff.json.staff?.id ?? staff.json.id
  expect(staffId).toBeTruthy()

  const tag = `e2e-pin-${Date.now()}@gaweee.test`
  const cashier = await api(page, 'POST', '/api/admin/users', { email: tag, full_name: 'E2E PIN Cashier (temp)', role: 'cashier', outlet_id: outletId })
  expect(cashier.status).toBe(201)

  const ctx = await browser.newContext()
  const cp = await ctx.newPage()
  let invoiceId: string | undefined
  try {
    await login(cp, tag, cashier.json.temp_password)
    const sale = { outlet_id: outletId, items: [{ product_id: product.product_id, quantity: 1 }], payment_method: 'cash', discount_amount: Math.ceil(price * 0.6) }

    const refused = await api(cp, 'POST', '/api/invoices', sale)
    expect(refused.status).toBe(400)
    expect(refused.json.error).toContain('minta persetujuan manager')

    const wrongPin = await api(cp, 'POST', '/api/manager-approval', { outlet_id: outletId, pin: '000000' })
    expect(wrongPin.status).toBe(401)
    expect((await api(cp, 'POST', '/api/invoices', { ...sale, manager_override_pin: '000000' })).status).toBe(400)

    const rightPin = await api(cp, 'POST', '/api/manager-approval', { outlet_id: outletId, pin: PIN })
    expect(rightPin.status).toBe(200)
    expect(rightPin.json.approved).toBe(true)

    const approved = await api(cp, 'POST', '/api/invoices', { ...sale, manager_override_pin: PIN })
    expect(approved.status).toBe(201)
    invoiceId = approved.json.invoice_id

    const inv = await api(cp, 'GET', `/api/invoices/${invoiceId}`)
    expect(inv.json.invoice.discount_approved_by).toBe(manager.user_id ?? manager.id)
  } finally {
    if (invoiceId) await api(page, 'POST', `/api/invoices/${invoiceId}/void`, { reason: 'Pembersihan uji PIN manager otomatis' })
    await ctx.close()
    await api(page, 'DELETE', `/api/admin/users/${cashier.json.user_id}`)
    await api(page, 'DELETE', `/api/staff/${staffId}`)
  }
})
