import { test, expect, type Page } from '@playwright/test'
import { login, currentOutletId } from './helpers'

// Payroll breakdown (todo.md Phase 33 batch D): a paid-out kasbon becomes an
// itemized instalment deduction on the next payslip, and marking the run paid
// records the repayment. Uses a far-past period so it never mixes with real
// payroll.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('kasbon instalment is itemized on the payslip and repaid when the run is paid', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outlets = await api(page, 'GET', '/api/outlets')
  const outletId: string = outlets.json.own_outlet_id ?? (await currentOutletId(page))

  // The demo outlet may have no staff, so provision a disposable one and
  // remove it at the end (soft delete).
  const created = await api(page, 'POST', '/api/staff', { outlet_id: outletId, first_name: 'E2E', last_name: 'Gaji', position: 'Kasir', hire_date: '2020-01-01', salary_amount: 1000000, commission_rate: 0 })
  expect(created.status).toBe(201)
  const staff = created.json.staff
  try {
  // Only this staff's slip is asserted; other outstanding kasbon just add their own items.
  const adv = await api(page, 'POST', '/api/cash-advances', { staff_id: staff.id, amount: 123456, reason: 'E2E rincian gaji', repay_per_period: 50000 })
  expect(adv.status).toBe(201)
  const advId = adv.json.advance.id
  expect((await api(page, 'PATCH', `/api/cash-advances/${advId}`, { action: 'approve' })).status).toBe(200)
  expect((await api(page, 'PATCH', `/api/cash-advances/${advId}`, { action: 'payout' })).status).toBe(200)

  const run = await api(page, 'POST', '/api/payroll/runs', { outlet_id: outletId, period_start: '2020-01-01', period_end: '2020-01-02' })
  expect(run.status).toBe(201)
  const detail = await api(page, 'GET', `/api/payroll/runs/${run.json.payroll_run_id}`)
  const slip = detail.json.payslips.find((p: { staff_id: string }) => p.staff_id === staff.id)
  const kasbon = slip.payslip_items.filter((i: { kind: string }) => i.kind === 'kasbon')
  expect(kasbon.some((i: { amount: number }) => i.amount === 50000)).toBe(true)
  expect(slip.deductions).toBeGreaterThanOrEqual(50000)
  const earn = slip.payslip_items.filter((i: { kind: string }) => i.kind !== 'kasbon').reduce((s: number, i: { amount: number }) => s + i.amount, 0)
  const ded = slip.payslip_items.filter((i: { kind: string }) => i.kind === 'kasbon').reduce((s: number, i: { amount: number }) => s + i.amount, 0)
  expect(earn - ded).toBe(slip.net_pay)

  expect((await api(page, 'POST', `/api/payroll/runs/${run.json.payroll_run_id}/pay`)).status).toBe(200)
  const hist = await api(page, 'GET', `/api/staff/${staff.id}/history?type=overview`)
  expect(hist.status).toBe(200)
  const list = await api(page, 'GET', `/api/cash-advances?outlet_id=${outletId}&staff_id=${staff.id}`)
  const mine = list.json.advances.find((a: { id: string }) => a.id === advId)
  expect(mine.repaid).toBe(50000)
  } finally {
    await api(page, 'DELETE', `/api/staff/${staff.id}`)
  }
})
