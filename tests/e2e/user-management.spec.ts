import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Users: an outlet is required (accounts without one could not open any page),
// edits are whitelisted, the owner cannot lock themselves out, deactivate /
// reactivate / reset-password work, and everything lands in the audit log.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('user lifecycle and lockout guards', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outlets = (await api(page, 'GET', '/api/outlets')).json
  const outletId: string = outlets.own_outlet_id
  const otherOutlet: string = outlets.outlets.find((o: { id: string }) => o.id !== outletId)?.id ?? outletId
  const tag = `e2e${Date.now()}`

  // No outlet -> refused; bad email -> refused.
  expect((await api(page, 'POST', '/api/admin/users', { email: `${tag}@example.com`, full_name: 'Tanpa Outlet', role: 'cashier' })).status).toBe(400)
  expect((await api(page, 'POST', '/api/admin/users', { email: 'bukan-email', full_name: 'X', role: 'cashier', outlet_id: outletId })).status).toBe(400)

  const created = await api(page, 'POST', '/api/admin/users', { email: `${tag}@example.com`, full_name: `E2E ${tag}`, role: 'cashier', outlet_id: outletId })
  expect(created.status).toBe(201)
  expect(created.json.temp_password).toMatch(/[A-Z]/)
  const id: string = created.json.user_id

  try {
    const list = await api(page, 'GET', `/api/admin/users?search=${tag}`)
    expect(list.json.users[0]).toMatchObject({ user_id: id, role: 'cashier', outlet_id: outletId, status: 'active' })

    // Whitelisted edits: role/outlet/name move; unknown fields and 'master_admin' are refused.
    expect((await api(page, 'PUT', `/api/admin/users/${id}`, { company_id: '00000000-0000-0000-0000-000000000000' })).status).toBe(400)
    expect((await api(page, 'PUT', `/api/admin/users/${id}`, { role: 'master_admin' })).status).toBe(400)
    expect((await api(page, 'PUT', `/api/admin/users/${id}`, { role: 'outlet_manager', outlet_id: otherOutlet, full_name: `E2E baru ${tag}` })).status).toBe(200)
    expect((await api(page, 'GET', `/api/admin/users?search=${tag}`)).json.users[0]).toMatchObject({ role: 'outlet_manager', outlet_id: otherOutlet })

    // The owner cannot lock themselves out.
    const me = (await api(page, 'GET', '/api/admin/users?role=master_admin')).json.users
    const self = me.find((u: { outlet_id: string | null }) => u.outlet_id === outletId) ?? me[0]
    expect((await api(page, 'DELETE', `/api/admin/users/${self.user_id}`)).status).toBeGreaterThanOrEqual(409)
    expect((await api(page, 'PUT', `/api/admin/users/${self.user_id}`, { role: 'cashier' })).status).toBeGreaterThanOrEqual(409)

    // Deactivate -> inactive; reactivate -> active; reset password gives a fresh one.
    expect((await api(page, 'PUT', `/api/admin/users/${id}`, { status: 'inactive' })).status).toBe(200)
    expect((await api(page, 'GET', `/api/admin/users?search=${tag}&status=inactive`)).json.users).toHaveLength(1)
    expect((await api(page, 'PUT', `/api/admin/users/${id}`, { status: 'active' })).status).toBe(200)
    const reset = await api(page, 'POST', `/api/admin/users/${id}/reset-password`)
    expect(reset.status).toBe(200)
    expect(reset.json.temp_password).not.toBe(created.json.temp_password)

    // Audit trail with who did it.
    const audit = await api(page, 'GET', '/api/admin/audit-log?entity_type=user&limit=50')
    const mine = audit.json.logs.filter((l: { entity_id: string }) => l.entity_id === id)
    expect(mine.length).toBeGreaterThanOrEqual(4)
    expect(mine[0].user_name).toBeTruthy()
  } finally {
    await api(page, 'DELETE', `/api/admin/users/${id}`)
  }
})
