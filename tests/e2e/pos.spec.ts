import { test, expect } from '@playwright/test'

// Requires a real Supabase project + a seeded test account (see database/seed/seed.sql
// and todo.md's "Supabase project" note). Credentials come from env vars rather than
// being hardcoded here, since this file is committed to git:
//   E2E_TEST_EMAIL, E2E_TEST_PASSWORD  — an existing master_admin/cashier account
//   E2E_TEST_PRODUCT_BARCODE           — a product barcode with stock > 0 at that user's outlet
const EMAIL = process.env.E2E_TEST_EMAIL
const PASSWORD = process.env.E2E_TEST_PASSWORD
const BARCODE = process.env.E2E_TEST_PRODUCT_BARCODE

test.describe('POS transaction flow', () => {
  test.skip(!EMAIL || !PASSWORD || !BARCODE, 'E2E_TEST_EMAIL/PASSWORD/PRODUCT_BARCODE not set')

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', EMAIL!)
    await page.fill('input[name="password"]', PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('complete cash sale: scan -> pay -> receipt', async ({ page }) => {
    await page.goto('/pos')

    const searchInput = page.getByPlaceholder('Scan barcode atau cari produk')
    await searchInput.fill(BARCODE!)
    await searchInput.press('Enter')

    // Item lands in the cart
    await expect(page.locator('text=Keranjang (1 item)')).toBeVisible()

    await page.getByRole('button', { name: 'Proses Pembayaran' }).click()

    // Cash screen: type an amount >= total, confirm
    const cashInput = page.getByPlaceholder('Jumlah diterima')
    await cashInput.fill('1000000')
    await page.getByRole('button', { name: 'Konfirmasi Pembayaran' }).click()

    await expect(page.locator('text=PEMBAYARAN BERHASIL')).toBeVisible()
    await expect(page.locator('text=/INV-\\d+/')).toBeVisible()
  })

  test('rejects checkout with an empty cart', async ({ page }) => {
    await page.goto('/pos')
    const checkoutButton = page.getByRole('button', { name: 'Proses Pembayaran' })
    await expect(checkoutButton).toBeDisabled()
  })
})
