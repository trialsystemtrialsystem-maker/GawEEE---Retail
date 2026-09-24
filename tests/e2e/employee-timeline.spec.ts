import { test, expect, type Page } from '@playwright/test'
import { login, currentOutletId } from './helpers'

// Employee timeline (todo.md Phase 33 batch E): hire + trigger-logged salary
// change + a manual warning all show up, and the overview carries the leave
// balance. Uses a disposable staff member (soft-deleted afterwards).
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('timeline merges hire, salary change and manual warning; overview has leave balance', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outlets = await api(page, 'GET', '/api/outlets')
  const outletId: string = outlets.json.own_outlet_id ?? (await currentOutletId(page))

  const created = await api(page, 'POST', '/api/staff', { outlet_id: outletId, first_name: 'E2E', last_name: 'Linimasa', position: 'Kasir', hire_date: '2024-01-01', salary_amount: 1000000 })
  expect(created.status).toBe(201)
  const id: string = created.json.staff.id
  try {
    expect((await api(page, 'PATCH', `/api/staff/${id}`, { salary_amount: 1500000 })).status).toBe(200)
    const ev = await api(page, 'POST', `/api/staff/${id}/events`, { event_type: 'warning', note: 'E2E peringatan terlambat' })
    expect(ev.status).toBe(201)

    const tl = await api(page, 'GET', `/api/staff/${id}/history?type=timeline`)
    expect(tl.status).toBe(200)
    const kinds = tl.json.rows.map((r: { kind: string }) => r.kind)
    expect(kinds).toEqual(expect.arrayContaining(['hired', 'salary_change', 'warning']))

    const ov = await api(page, 'GET', `/api/staff/${id}/history?type=overview`)
    expect(ov.json.summary.leave_balance.remaining).toBeLessThanOrEqual(ov.json.summary.leave_balance.entitlement)
  } finally {
    await api(page, 'DELETE', `/api/staff/${id}`)
  }
})
