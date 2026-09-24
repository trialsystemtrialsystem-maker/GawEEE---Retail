import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Jurnal balik: a posted manual entry is reversed by a mirror entry, the
// original becomes 'reversed', and the Neraca Saldo nets back to where it
// started (reports count posted + reversed, so the pair cancels).
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('reversing a posted journal nets the books back and marks the original', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const accounts = (await api(page, 'GET', `/api/accounting/accounts?outlet_id=${outletId}`)).json.accounts as { id: string; account_code: string }[]
  const kas = accounts.find((a) => a.account_code === '1000')!
  const modal = accounts.find((a) => a.account_code === '3000')!

  const tb = async () => {
    const r = await api(page, 'GET', `/api/accounting/reports?type=trial-balance&outlet_id=${outletId}`)
    return JSON.stringify(r.json)
  }
  // Neraca balances by construction (unclosed income/expense shown as Laba Berjalan).
  const bs = await api(page, 'GET', `/api/accounting/reports?type=balance-sheet&outlet_id=${outletId}`)
  expect(bs.json.isBalanced).toBe(true)
  const before = await tb()

  const created = await api(page, 'POST', '/api/accounting/journal-entries', {
    outlet_id: outletId,
    entry_date: new Date().toISOString().slice(0, 10),
    description: 'E2E jurnal balik',
    lines: [
      { account_id: kas.id, debit: 12345, credit: 0 },
      { account_id: modal.id, debit: 0, credit: 12345 },
    ],
  })
  expect(created.status).toBe(201)
  const id = created.json.journal_entry_id
  expect((await api(page, 'POST', `/api/accounting/journal-entries/${id}/post`)).status).toBe(200)
  expect(await tb()).not.toBe(before)

  const rev = await api(page, 'POST', `/api/accounting/journal-entries/${id}/reverse`, { reason: 'uji jurnal balik' })
  expect(rev.status).toBe(200)
  expect(await tb()).toBe(before)

  const original = await api(page, 'GET', `/api/accounting/journal-entries/${id}`)
  expect(original.json.entry.status).toBe('reversed')
  // Cannot reverse twice.
  expect((await api(page, 'POST', `/api/accounting/journal-entries/${id}/reverse`, { reason: 'lagi' })).status).toBe(409)
})
