import { type Page, expect } from '@playwright/test'

// Shared helpers for the stateful e2e specs that drive real checkout/void
// flows against a live, seeded account (see playwright.config.ts — these all
// run serially, one worker, against the same backend). Not a test file
// itself (no `*.spec.ts` suffix), so Playwright won't try to run it.

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Always logs out first — navigating to /auth/login with an existing
// session still active redirects straight back to /dashboard instead of
// showing the form (found live: a bare page.goto('/auth/login') to switch
// users mid-test hung waiting for the email input that never appeared).
export async function login(page: Page, email: string, password: string) {
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})).catch(() => {})
  await page.goto('/auth/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
}

export async function currentOutletId(page: Page): Promise<string> {
  const outletId = await page.evaluate(async () => {
    const res = await fetch('/api/outlets')
    const data = await res.json()
    return data.outlets?.[0]?.id as string | undefined
  })
  if (!outletId) throw new Error('E2E setup: logged-in account has no outlet')
  return outletId
}

// Picks whatever real, in-stock product the live catalog happens to have
// (via the API) rather than hardcoding a product name — this account's
// actual catalog can drift from lib/demo/catalog.ts's static list after
// months of manual testing on top of it, across this whole session.
export async function pickInStockProduct(page: Page, outletId: string) {
  const product = await page.evaluate(async (oid) => {
    const res = await fetch(`/api/inventory/${oid}`)
    const data = await res.json()
    type Item = { product_id: string; name: string; quantity_available: number }
    return (data.inventory as Item[] | undefined)?.find((p) => p.quantity_available > 0)
  }, outletId)
  if (!product) throw new Error('E2E setup: no in-stock product found to sell')
  return product as { product_id: string; name: string; quantity_available: number }
}

// Types the product into the POS search box and adds it to the cart via a
// tile click (Enter only does an exact barcode lookup, see ProductSearch.tsx
// — free-text search only filters which tiles render). Handles the unit- or
// modifier-picker modal some products open instead of adding straight to the
// cart (Multi-UOM / Extra Product), so this works for any in-stock product.
export async function addProductToCart(page: Page, productName: string) {
  const searchInput = page.getByPlaceholder('Scan barcode atau cari produk')
  await searchInput.fill(productName)
  await page.getByRole('button', { name: new RegExp(escapeRegExp(productName)) }).first().click()

  const baseUnitButton = page.getByRole('button', { name: 'Satuan Dasar' })
  const addToCartButton = page.getByRole('button', { name: 'Tambah ke Keranjang' })
  if (await baseUnitButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await baseUnitButton.click()
  } else if (await addToCartButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await addToCartButton.click()
  }
}

// Creates a one-item cash sale from whatever real, in-stock product the
// live catalog happens to have, and returns its invoice id.
export async function createCashSale(page: Page): Promise<string> {
  await page.goto('/pos')
  const outletId = await currentOutletId(page)
  const product = await pickInStockProduct(page, outletId)
  await addProductToCart(page, product.name)
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

// Must be called while logged in as a manager (master_admin/outlet_manager)
// — call sites reuse the session, no relogin.
export async function voidNow(page: Page, invoiceId: string, reason: string) {
  await page.goto(`/dashboard/sales/${invoiceId}`)
  page.once('dialog', (dialog) => dialog.accept(reason))
  await page.getByRole('button', { name: 'Batalkan Transaksi' }).click()
  await expect(page.locator('text=Transaksi berhasil dibatalkan')).toBeVisible()
}
