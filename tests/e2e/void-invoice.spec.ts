import { test, expect, type Page, type Browser } from '@playwright/test'

// Regression coverage for void_invoice()'s manager-only fraud-prevention gate
// (see app/api/reports/void-analysis/route.ts's docstring on why voids are a
// real fraud signal — "sweethearting": ring a sale, void it after the
// customer leaves with the goods) — this path had zero e2e coverage despite
// being one of the money-critical flows this codebase leans on most.
//
// The manager account defaults to the demo tenant's (lib/demo/catalog.ts) —
// not secret, already committed there for the public "Coba Demo" seeder —
// so this runs out of the box against a demo-seeded account, unlike
// pos.spec.ts's fully env-gated approach. Override via env vars to point it
// at a different seeded master_admin/outlet_manager account instead.
//
// The cashier used in the permission-check test is created fresh via
// POST /api/admin/users and deleted at the end, rather than relying on
// lib/demo/catalog.ts's separate DEMO_CASHIER_EMAIL login — found live that
// account can belong to a different company than DEMO_EMAIL in a database
// that's accumulated manual testing across many sessions (RLS would make
// them unable to even see each other's invoices, invalidating the test).
// A disposable same-company cashier sidesteps that drift entirely.
const MANAGER_EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const MANAGER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Always logs out first — navigating to /auth/login with an existing
// session still active redirects straight back to /dashboard instead of
// showing the form (found live: a bare page.goto('/auth/login') to switch
// users mid-test hung waiting for the email input that never appeared).
async function login(page: Page, email: string, password: string) {
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})).catch(() => {})
  await page.goto('/auth/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
}

async function currentOutletId(page: Page): Promise<string> {
  const outletId = await page.evaluate(async () => {
    const res = await fetch('/api/outlets')
    const data = await res.json()
    return data.outlets?.[0]?.id as string | undefined
  })
  if (!outletId) throw new Error('E2E setup: logged-in account has no outlet')
  return outletId
}

// Creates a one-item cash sale and returns its invoice id. Picks whatever
// real, in-stock product the live catalog happens to have (via the API)
// rather than hardcoding a product name — this account's actual catalog can
// drift from lib/demo/catalog.ts's static list after months of manual
// testing on top of it, across this whole session.
async function createCashSale(page: Page): Promise<string> {
  await page.goto('/pos')

  const outletId = await currentOutletId(page)
  const product = await page.evaluate(async (oid) => {
    const res = await fetch(`/api/inventory/${oid}`)
    const data = await res.json()
    type Item = { product_id: string; name: string; quantity_available: number }
    return (data.inventory as Item[] | undefined)?.find((p) => p.quantity_available > 0)
  }, outletId)
  if (!product) throw new Error('E2E setup: no in-stock product found to sell')

  const searchInput = page.getByPlaceholder('Scan barcode atau cari produk')
  await searchInput.fill(product.name)
  await page.getByRole('button', { name: new RegExp(escapeRegExp(product.name)) }).first().click()

  // Some products open a unit- or modifier-picker modal instead of adding
  // straight to the cart (Multi-UOM / Extra Product) — handle both so this
  // works no matter which in-stock product got picked above.
  const baseUnitButton = page.getByRole('button', { name: 'Satuan Dasar' })
  const addToCartButton = page.getByRole('button', { name: 'Tambah ke Keranjang' })
  if (await baseUnitButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await baseUnitButton.click()
  } else if (await addToCartButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await addToCartButton.click()
  }

  await expect(page.locator('text=Keranjang (1 item)')).toBeVisible()

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/invoices') && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Proses Pembayaran' }).click(),
  ])
  const body = await response.json()

  const cashInput = page.getByPlaceholder('Jumlah diterima')
  await cashInput.fill('1000000')
  await page.getByRole('button', { name: 'Konfirmasi Pembayaran' }).click()
  await expect(page.locator('text=Pembayaran Berhasil')).toBeVisible()

  return body.invoice_id as string
}

// Assumes `page` is already logged in as a manager — call sites reuse the
// session, no relogin.
async function voidNow(page: Page, invoiceId: string, reason: string) {
  await page.goto(`/dashboard/sales/${invoiceId}`)
  page.once('dialog', (dialog) => dialog.accept(reason))
  await page.getByRole('button', { name: 'Batalkan Transaksi' }).click()
  await expect(page.locator('text=Transaksi berhasil dibatalkan')).toBeVisible()
}

// Must be called while logged in as MANAGER_EMAIL (master_admin/manager).
async function createDisposableCashier(page: Page, outletId: string) {
  const email = `e2e-void-test-${Date.now()}@gaweee.test`
  const result = await page.evaluate(
    async ({ email, outletId }) => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: 'E2E Cashier (temp)', role: 'cashier', outlet_id: outletId }),
      })
      return { status: res.status, body: await res.json() }
    },
    { email, outletId }
  )
  if (result.status !== 201) throw new Error(`E2E setup: failed to create disposable cashier — ${JSON.stringify(result.body)}`)
  return { userId: result.body.user_id as string, email, password: result.body.temp_password as string }
}

// Must be called while logged in as a master_admin. Best-effort hygiene, not
// a test assertion — bounded with its own timeout so a slow/hanging DELETE
// can't blow the whole test's budget, and deliberately swallows errors.
async function deleteDisposableUser(page: Page, userId: string) {
  await page
    .evaluate(async (id) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE', signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
    }, userId)
    .catch(() => {})
}

test.describe('Void invoice — manager-only fraud-prevention gate', () => {
  // Generous — /api/auth/login is IP-rate-limited (10/5min, see
  // app/api/auth/login/route.ts), and each test here does at most 2 real
  // logins across two browser contexts (manager once, cashier once) rather
  // than repeatedly logging the same page in and out, to stay well under it.
  test.setTimeout(60_000)

  test('cashier cannot void an invoice — UI hides the button and the API rejects a direct call', async ({ page, browser }: { page: Page; browser: Browser }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    const outletId = await currentOutletId(page)
    const invoiceId = await createCashSale(page)
    const cashier = await createDisposableCashier(page, outletId)

    // A second, independent browser context/session for the cashier — no
    // logout/relogin flip-flopping on one page, and it's a more realistic
    // model of "two different users" than sharing one page's cookies.
    const cashierContext = await browser.newContext()
    const cashierPage = await cashierContext.newPage()
    try {
      await login(cashierPage, cashier.email, cashier.password)
      await cashierPage.goto(`/dashboard/sales/${invoiceId}`)
      await expect(cashierPage.getByRole('button', { name: 'Batalkan Transaksi' })).toHaveCount(0)

      // Defense in depth — bypass the UI entirely and hit the route directly
      // with the cashier's own session cookies; void_invoice() itself (and
      // the route's own role check) must reject it independent of the UI gate.
      const status = await cashierPage.evaluate(async (id) => {
        const res = await fetch(`/api/invoices/${id}/void`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'percobaan bypass UI (uji regresi otomatis)' }),
        })
        return res.status
      }, invoiceId)
      expect(status).toBe(403)
    } finally {
      await cashierContext.close()
    }

    // Cleanup — void the test invoice for real (manager's session on `page`
    // is still active, no relogin needed) and remove the disposable cashier,
    // so repeated runs don't leave junk unvoided invoices, drain the
    // product's stock, or accumulate throwaway users.
    await voidNow(page, invoiceId, 'Pembersihan data uji regresi otomatis')
    await deleteDisposableUser(page, cashier.userId)
  })

  test('manager can void a sale with a reason, and the stock it sold is restored', async ({ page }) => {
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
    page.once('dialog', (dialog) => dialog.accept('Pelanggan membatalkan pesanan (uji regresi otomatis)'))
    await page.getByRole('button', { name: 'Batalkan Transaksi' }).click()

    await expect(page.locator('text=Transaksi berhasil dibatalkan')).toBeVisible()
    await expect(page.locator('text=Dibatalkan')).toBeVisible()
    await expect(page.locator('text=Alasan pembatalan:')).toBeVisible()

    const afterQty = await quantityOnHand()
    expect(afterQty).toBe(beforeQty + item.quantity)
  })
})
