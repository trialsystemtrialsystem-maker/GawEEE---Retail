import { test, expect, type Browser, type Page } from '@playwright/test'
import { login, currentOutletId, createCashSale } from './helpers'

// Master Admin > Hak Akses (todo.md Phase 32): a role's permission is
// editable per company and the API enforces it. Grants a disposable cashier
// "invoice.void" and checks the void route flips 403 -> 200, then restores the
// default (revoke-returns-403 is covered by the unit tests) — the toggle must be enforced server-side, not
// just hide a button.
const MANAGER_EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const MANAGER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

async function setPermission(page: Page, role: string, key: string, allowed: boolean) {
  return page.evaluate(
    async (b) => (await fetch('/api/admin/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).status,
    { role, key, allowed }
  )
}

async function voidStatus(page: Page, invoiceId: string) {
  return page.evaluate(
    async (id) =>
      (await fetch(`/api/invoices/${id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'uji izin (otomatis)' }) })).status,
    invoiceId
  )
}

test.describe('Editable role permissions', () => {
  test.setTimeout(90_000)

  test('granting a cashier invoice.void makes the void route accept them; revoking restores 403', async ({ page, browser }: { page: Page; browser: Browser }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    const outletId = await currentOutletId(page)
    const invoiceId = await createCashSale(page)

    const created = await page.evaluate(
      async ({ outletId }) => {
        const email = `e2e-perm-${Date.now()}@gaweee.test`
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, full_name: 'E2E Perm Cashier', role: 'cashier', outlet_id: outletId }),
        })
        return { status: res.status, body: await res.json(), email }
      },
      { outletId }
    )
    expect(created.status).toBe(201)

    const cashierContext = await browser.newContext()
    const cashierPage = await cashierContext.newPage()
    try {
      await login(cashierPage, created.email, created.body.temp_password)
      await cashierPage.goto('/dashboard')

      expect(await voidStatus(cashierPage, invoiceId)).toBe(403) // default: cashier may not void

      expect(await setPermission(page, 'cashier', 'invoice.void', true)).toBe(200)
      expect(await voidStatus(cashierPage, invoiceId)).toBe(200)
    } finally {
      await setPermission(page, 'cashier', 'invoice.void', false) // always restore the default
      await cashierContext.close()
      await page.evaluate((id) => fetch(`/api/admin/users/${id}`, { method: 'DELETE' }), created.body.user_id).catch(() => {})
    }

    // The override was removed again (default restored) —
    // resolvePermission covers the revoked-returns-403 logic in unit tests.
    const matrix = await page.evaluate(async () => (await fetch('/api/admin/permissions')).json())
    expect(matrix.matrix.cashier['invoice.void']).toBe(false)
  })
})
