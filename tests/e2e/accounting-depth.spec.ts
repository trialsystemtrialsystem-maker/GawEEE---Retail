import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Needs migration 065. Fixed-asset depreciation, budgets, and tutup buku
// (close -> locked -> reopen). Uses tiny amounts dated 2020 so it never mixes
// with real periods.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

const EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

test.describe('Accounting depth', () => {
  test.setTimeout(180_000)

  test('asset depreciation is booked once per month and journaled', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
    const created = await api(page, 'POST', '/api/accounting/fixed-assets', {
      outlet_id: outletId, name: 'E2E Rak', acquisition_date: '2020-01-15', cost: 12000, salvage_value: 0, useful_life_months: 12, pay_from: 'cash',
    })
    expect(created.status).toBe(201)
    const first = await api(page, 'POST', '/api/accounting/fixed-assets/depreciate', { outlet_id: outletId, month: '2020-01' })
    expect(first.status).toBe(200)
    expect(first.json.depreciated).toBeGreaterThanOrEqual(1)
    expect(first.json.journaled).toBe(true)
    const again = await api(page, 'POST', '/api/accounting/fixed-assets/depreciate', { outlet_id: outletId, month: '2020-01' })
    expect(again.json.depreciated).toBe(0)
    const list = await api(page, 'GET', `/api/accounting/fixed-assets?outlet_id=${outletId}`)
    const mine = list.json.assets.find((a: { id: string }) => a.id === created.json.asset.id)
    expect(mine.accumulated_depreciation).toBe(1000)
    expect(mine.book_value).toBe(11000)
  })

  test('budget vs actual round-trips', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
    const before = await api(page, 'GET', `/api/accounting/budgets?outlet_id=${outletId}&month=2020-06`)
    const acct = before.json.rows.find((r: { account_type: string }) => r.account_type === 'expense')
    expect((await api(page, 'PUT', '/api/accounting/budgets', { outlet_id: outletId, month: '2020-06', items: [{ account_id: acct.account_id, amount: 5000 }] })).status).toBe(200)
    const after = await api(page, 'GET', `/api/accounting/budgets?outlet_id=${outletId}&month=2020-06`)
    expect(after.json.rows.find((r: { account_id: string }) => r.account_id === acct.account_id).budget).toBe(5000)
    await api(page, 'PUT', '/api/accounting/budgets', { outlet_id: outletId, month: '2020-06', items: [{ account_id: acct.account_id, amount: 0 }] })
  })

  test('closing a period locks it and reopening unlocks it', async ({ page }) => {
    await login(page, EMAIL, PASSWORD)
    const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
    const accounts = (await api(page, 'GET', `/api/accounting/accounts?outlet_id=${outletId}`)).json.accounts as { id: string; account_code: string }[]
    const kas = accounts.find((a) => a.account_code === '1000')!
    const pendapatan = accounts.find((a) => a.account_code === '4000')!
    const entry = (date: string) => ({
      outlet_id: outletId, entry_date: date, description: 'E2E tutup buku',
      lines: [{ account_id: kas.id, debit: 700, credit: 0 }, { account_id: pendapatan.id, debit: 0, credit: 700 }],
    })

    // A fresh month per run (2018-2019): earlier runs leave posted entries behind.
    const slot = Math.floor(Date.now() / 60_000) % 24
    const ym = `${2018 + Math.floor(slot / 12)}-${String((slot % 12) + 1).padStart(2, '0')}`
    const lastDay = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).toISOString().slice(0, 10)
    const seed = await api(page, 'POST', '/api/accounting/journal-entries', entry(`${ym}-10`))
    expect(seed.status).toBe(201)
    expect((await api(page, 'POST', `/api/accounting/journal-entries/${seed.json.journal_entry_id}/post`)).status).toBe(200)

    const closed = await api(page, 'POST', '/api/accounting/periods', { outlet_id: outletId, period_start: `${ym}-01`, period_end: lastDay })
    expect(closed.status).toBe(201)
    expect(closed.json.net_profit).toBeGreaterThanOrEqual(700)

    // Locked: a new entry inside the range is rejected.
    expect((await api(page, 'POST', '/api/accounting/journal-entries', entry(`${ym}-20`))).status).toBeGreaterThanOrEqual(400)
    // Overlapping close is refused.
    expect((await api(page, 'POST', '/api/accounting/periods', { outlet_id: outletId, period_start: `${ym}-15`, period_end: '2020-12-31' })).status).toBe(409)
    // P&L still shows the period's income even though it was closed out.
    const pl = await api(page, 'GET', `/api/accounting/reports?type=profit-loss&outlet_id=${outletId}&start=${ym}-01&end=${lastDay}`)
    expect(pl.json.totalIncome).toBeGreaterThanOrEqual(700)

    expect((await api(page, 'POST', `/api/accounting/periods/${closed.json.period_id}/reopen`)).status).toBe(200)
    const again = await api(page, 'POST', '/api/accounting/journal-entries', entry(`${ym}-20`))
    expect(again.status).toBe(201)
    // Leave no draft behind: post it, then reverse it.
    await api(page, 'POST', `/api/accounting/journal-entries/${again.json.journal_entry_id}/post`)
    await api(page, 'POST', `/api/accounting/journal-entries/${again.json.journal_entry_id}/reverse`, { reason: 'E2E cleanup' })
  })
})
