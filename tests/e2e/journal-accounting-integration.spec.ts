import { test, expect } from '@playwright/test'

// Automated version of the manual Playwright regression pass that verified
// migration 059 (auto-posting a journal entry at sale time) — see todo.md
// Phase 3's "Automated integration test: transaction -> journal entry -> P&L
// accuracy" item. Runs against the public demo tenant (same credentials the
// landing page's "Coba Demo" button provisions) rather than being gated
// behind E2E_TEST_* env vars like pos.spec.ts, since these are not secret —
// this keeps it actually running in CI instead of silently skipping.
const DEMO_EMAIL = 'demo@gaweee.app'
const DEMO_PASSWORD = 'DemoGawEEE2026!'

test.describe('Sale -> journal entry -> P&L integration', () => {
  test('a cash sale auto-posts a balanced journal entry that flows into P&L income', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', DEMO_EMAIL)
    await page.fill('input[name="password"]', DEMO_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard|pos/)

    const me = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))
    const outletId: string = me.outlet.id

    const today = new Date().toISOString().slice(0, 10)
    const plBefore = await page.evaluate(
      ({ outletId, today }) => fetch(`/api/accounting/reports?outlet_id=${outletId}&type=profit-loss&start=${today}&end=${today}`).then((r) => r.json()),
      { outletId, today }
    )

    // A plain cash sale, no discount, so the revenue journal line (credited
    // at subtotal - discount_amount, see post_invoice_journal_entry() in
    // 059_sales_journal_trigger.sql) is exactly this product's price.
    await page.goto('/pos')
    const tile = page.locator('button', { hasText: 'Nugget Ayam 500gr' }).first()
    await tile.waitFor({ state: 'visible', timeout: 15000 })
    await tile.click()
    await page.waitForTimeout(500)
    const batalBtn = page.locator('button:has-text("Batal")').first()
    if (await batalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await batalBtn.click()
    }

    const [invoiceResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/invoices') && r.request().method() === 'POST'),
      page.click('button:has-text("Proses Pembayaran")'),
    ])
    const invoice = await invoiceResp.json()
    expect(invoiceResp.status()).toBe(201)

    await page.waitForResponse((r) => r.url().includes('/api/payments/initiate')).catch(() => null)

    const confirmCashBtn = page.locator('button:has-text("Konfirmasi Pembayaran")')
    await confirmCashBtn.waitFor({ state: 'visible', timeout: 10000 })
    await page.click('button:has-text("Uang Pas")')
    await expect(confirmCashBtn).toBeEnabled({ timeout: 5000 })
    await confirmCashBtn.click()
    await expect(page.locator('text=Pembayaran Berhasil')).toBeVisible({ timeout: 10000 })

    // The trigger fires at commit time (AFTER INSERT ... DEFERRED), so the
    // journal entry exists by the time the invoice API call above returned —
    // no extra wait needed before querying it.
    const journalRes = await page.evaluate(
      (outletId) => fetch(`/api/accounting/journal-entries?outlet_id=${outletId}`).then((r) => r.json()),
      outletId
    )
    const entries: { description: string; status: string; source_type: string; source_id: string }[] = journalRes.entries ?? journalRes
    const salesEntry = entries.find((e) => e.source_type === 'sales' && e.source_id === invoice.invoice_id && e.description === `Penjualan ${invoice.invoice_number}`)
    expect(salesEntry, `expected a posted journal entry "Penjualan ${invoice.invoice_number}"`).toBeTruthy()
    expect(salesEntry!.status).toBe('posted')

    const plAfter = await page.evaluate(
      ({ outletId, today }) => fetch(`/api/accounting/reports?outlet_id=${outletId}&type=profit-loss&start=${today}&end=${today}`).then((r) => r.json()),
      { outletId, today }
    )

    const revenueDelta = plAfter.totalIncome - plBefore.totalIncome
    expect(revenueDelta).toBeCloseTo(invoice.total / 1.1, 0) // total includes 10% PPN; subtotal = total / 1.1
  })
})
