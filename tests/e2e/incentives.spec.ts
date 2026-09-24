import { test, expect, type Page } from '@playwright/test'
import { login, currentOutletId } from './helpers'

// Daily incentives (todo.md Phase 33 batch C): create a rule, calculate a day
// twice (idempotent — same rows, no duplicates), and see the result in the
// per-staff history. Cleans up the rule it created.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test.describe('Daily incentives', () => {
  test.setTimeout(90_000)

  test('rule -> calculate is idempotent -> appears in employee history', async ({ page }) => {
    await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
    const outletId = await currentOutletId(page)
    const date = new Date().toISOString().slice(0, 10)

    const created = await api(page, 'POST', '/api/incentive-rules', { outlet_id: outletId, name: 'E2E Hadir', metric: 'attendance_bonus', threshold: 0, amount: 1000 })
    expect(created.status).toBe(201)
    const ruleId = created.json.rule?.id ?? created.json.id

    try {
      const a = await api(page, 'POST', '/api/incentives/calculate', { outlet_id: outletId, date })
      expect(a.status).toBe(200)
      const b = await api(page, 'POST', '/api/incentives/calculate', { outlet_id: outletId, date })
      expect(b.json.incentives_created).toBe(a.json.incentives_created)

      const list = await api(page, 'GET', `/api/incentives?outlet_id=${outletId}&date=${date}`)
      expect(list.json.incentives.length).toBe(a.json.incentives_created)
    } finally {
      if (ruleId) await api(page, 'DELETE', `/api/incentive-rules/${ruleId}`)
    }
  })
})
