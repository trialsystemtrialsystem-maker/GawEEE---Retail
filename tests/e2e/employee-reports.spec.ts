import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Company-wide employee history report (todo.md Phase 33 batch F).
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('employee report lists each active staff member with the expected columns', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outlets = await api(page, 'GET', '/api/outlets')
  const outletId: string = outlets.json.own_outlet_id

  const created = await api(page, 'POST', '/api/staff', { outlet_id: outletId, first_name: 'E2E', last_name: 'Laporan', position: 'Kasir', hire_date: '2024-01-01', salary_amount: 1000000 })
  expect(created.status).toBe(201)
  const id: string = created.json.staff.id
  try {
    const res = await api(page, 'GET', `/api/staff/reports?outlet_id=${outletId}`)
    expect(res.status).toBe(200)
    const mine = res.json.rows.find((r: { staff_id: string }) => r.staff_id === id)
    expect(mine).toMatchObject({ present_days: 0, late_minutes: 0, incentive_total: 0, kasbon_outstanding: 0, net_pay_paid: 0 })

    await page.goto('/dashboard/staff/reports')
    await expect(page.getByRole('heading', { name: 'Riwayat Karyawan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'E2E Laporan' })).toBeVisible({ timeout: 30_000 })
  } finally {
    await api(page, 'DELETE', `/api/staff/${id}`)
  }
})
