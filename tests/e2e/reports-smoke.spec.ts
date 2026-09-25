import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Every report route that aggregates in JS was moved to paged reads (PostgREST
// silently caps a single request at 1000 rows). This smoke test hits them all
// with default parameters so a paging regression (bad ordering, broken embed)
// shows up as a non-200.
async function get(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u)
    return { status: res.status, json: await res.json().catch(() => ({})) }
  }, url)
}

test('paged report routes still answer', async ({ page }) => {
  test.setTimeout(400_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await get(page, '/api/outlets')).json.own_outlet_id

  const urls = [
    '/api/reports/sales-trend',
    `/api/reports/p-and-l?outlet_id=${outletId}`,
    '/api/invoices/daily-summary',
    '/api/admin/outlets',
    '/api/admin/outlets/daily',
    '/api/admin/outlets/hourly',
    '/api/reports/abc-analysis',
    '/api/reports/customer-segmentation',
    '/api/reports/customer-summary',
    '/api/reports/kitchen',
    '/api/reports/market-basket',
    '/api/reports/new-vs-returning',
    '/api/reports/peak-time',
    '/api/reports/service',
    '/api/reports/stock-turnover',
    '/api/reports/target-vs-actual',
    '/api/reports/void-analysis',
    '/api/reports/accounts-receivable',
    '/api/pos/my-daily-report',
    `/api/inventory/expiry?outlet_id=${outletId}`,
    `/api/accounting/reports?type=trial-balance&outlet_id=${outletId}`,
    `/api/accounting/reports?type=balance-sheet&outlet_id=${outletId}`,
    `/api/accounting/reports?type=profit-loss&outlet_id=${outletId}`,
    `/api/accounting/reports?type=cash-flow&outlet_id=${outletId}`,
    `/api/staff/reports?outlet_id=${outletId}`,
  ]
  const failures: string[] = []
  for (const url of urls) {
    const r = await get(page, url)
    if (r.status !== 200) failures.push(`${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`)
  }
  expect(failures).toEqual([])

  // The books still balance after paging.
  const tb = await get(page, `/api/accounting/reports?type=trial-balance&outlet_id=${outletId}`)
  expect(tb.json.is_balanced).toBe(true)
  const bs = await get(page, `/api/accounting/reports?type=balance-sheet&outlet_id=${outletId}`)
  expect(bs.json.isBalanced).toBe(true)
})
