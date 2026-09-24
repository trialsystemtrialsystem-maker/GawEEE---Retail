import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Aturan Penggajian (Master Admin): a tunjangan and a percent deduction show up
// as itemized lines on the next payslip, totals reconcile, and the payroll
// journal credits Utang Pajak for the withheld amount. Rules are reset after.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}
const EMPTY = { late_penalty_per_minute: 0, overtime_per_hour: 0, absence_deduction_per_day: 0, allowances: [], percent_deductions: [], leave_days_per_year: 12 }

test('payroll rules flow into itemized payslips', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const created = await api(page, 'POST', '/api/staff', { outlet_id: outletId, first_name: 'E2E', last_name: 'Aturan', position: 'Kasir', hire_date: '2020-01-01', salary_amount: 2000000, commission_rate: 0 })
  expect(created.status).toBe(201)
  const staff = created.json.staff
  try {
    const saved = await api(page, 'PATCH', '/api/admin/payroll-rules', { ...EMPTY, allowances: [{ label: 'Transport', amount: 100000 }], percent_deductions: [{ label: 'BPJS', percent: 2 }] })
    expect(saved.status).toBe(200)
    const run = await api(page, 'POST', '/api/payroll/runs', { outlet_id: outletId, period_start: '2020-02-01', period_end: '2020-02-02' })
    expect(run.status).toBe(201)
    const detail = await api(page, 'GET', `/api/payroll/runs/${run.json.payroll_run_id}`)
    const slip = detail.json.payslips.find((p: { staff_id: string }) => p.staff_id === staff.id)
    const labels = slip.payslip_items.map((i: { label: string }) => i.label)
    expect(labels).toContain('Tunjangan: Transport')
    expect(labels.some((l: string) => l.startsWith('BPJS'))).toBe(true)
    expect(slip.net_pay).toBe(2000000 + 100000 - 40000)
    expect((await api(page, 'POST', `/api/payroll/runs/${run.json.payroll_run_id}/pay`)).status).toBe(200)
  } finally {
    await api(page, 'PATCH', '/api/admin/payroll-rules', EMPTY)
    await api(page, 'DELETE', `/api/staff/${staff.id}`)
  }
})
