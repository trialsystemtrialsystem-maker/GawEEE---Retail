import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// "Perlu Perhatian": a new online order shows up in the owner's dashboard action
// list, links to where it is handled, and disappears once handled.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('attention center reflects pending work', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const countOf = async () => ((await api(page, 'GET', `/api/dashboard/attention?outlet_id=${outletId}`)).json.items as { key: string; count: number; href: string }[]).find((i) => i.key === 'online_incoming')?.count ?? 0

  const before = await countOf()
  const order = await api(page, 'POST', '/api/online-orders', { outlet_id: outletId, channel: 'whatsapp', customer_name: `E2E-ATT-${Date.now()}`, items: [{ name: 'Item bebas', quantity: 1, price: 1000 }] })
  expect(order.status).toBe(201)
  expect(await countOf()).toBe(before + 1)

  const list = (await api(page, 'GET', `/api/dashboard/attention?outlet_id=${outletId}`)).json.items as { key: string; href: string; severity: string }[]
  expect(list.find((i) => i.key === 'online_incoming')).toMatchObject({ href: '/dashboard/online-orders', severity: 'critical' })
  // Most urgent first.
  const severities = list.map((i) => i.severity)
  expect(severities).toEqual([...severities].sort((a, b) => ({ critical: 0, warning: 1, info: 2 } as Record<string, number>)[a] - ({ critical: 0, warning: 1, info: 2 } as Record<string, number>)[b]))

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Perlu Perhatian' })).toBeVisible({ timeout: 60_000 })

  await api(page, 'PATCH', `/api/online-orders/${order.json.order.id}/status`, { status: 'cancelled', reason: 'E2E' })
  expect(await countOf()).toBe(before)
})
