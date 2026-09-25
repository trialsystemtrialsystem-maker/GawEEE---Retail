import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Needs migration 068. Broadcasts are a personalised send queue: templates are
// rendered per recipient, opted-out customers are excluded, unknown placeholders
// are refused, and sent_count only grows when recipients are marked sent.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('whatsapp broadcast queue', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const tag = `E2E-WA-${Date.now()}`
  const suffix = String(Date.now()).slice(-8)

  const bad = await api(page, 'POST', '/api/whatsapp/templates', { outlet_id: outletId, name: `${tag}-bad`, content: 'Halo {nmaa}' })
  const badBroadcast = await api(page, 'POST', '/api/whatsapp/broadcasts', { outlet_id: outletId, template_id: bad.json.template.id, target_note: 'x', audience: { type: 'customers' } })
  expect(badBroadcast.status).toBe(400)
  expect(badBroadcast.json.error).toContain('{nmaa}')

  const tpl = await api(page, 'POST', '/api/whatsapp/templates', { outlet_id: outletId, name: tag, content: 'Halo {nama}, dari {toko}!' })
  expect(tpl.status).toBe(201)

  const a = await api(page, 'POST', '/api/customers', { outlet_id: outletId, name: `${tag} Aktif`, phone: `0856${suffix}` })
  const b = await api(page, 'POST', '/api/customers', { outlet_id: outletId, name: `${tag} Berhenti`, phone: `0855${suffix}` })
  expect(a.status).toBe(201)
  expect((await api(page, 'PATCH', `/api/customers/${b.json.customer.id}`, { whatsapp_opt_out: true })).status).toBe(200)

  const created = await api(page, 'POST', '/api/whatsapp/broadcasts', { outlet_id: outletId, template_id: tpl.json.template.id, target_note: tag, audience: { type: 'customers' } })
  expect(created.status).toBe(201)
  expect(created.json.broadcast.status).toBe('draft')
  expect(created.json.broadcast.sent_count).toBe(0)
  const id: string = created.json.broadcast.id

  const queue = await api(page, 'GET', `/api/whatsapp/broadcasts/${id}`)
  const mine = queue.json.recipients.filter((r: { name: string }) => r.name.startsWith(tag))
  expect(mine.map((r: { name: string }) => r.name)).toEqual([`${tag} Aktif`]) // opted-out excluded
  expect(mine[0].message).toMatch(/^Halo E2E-WA-\d+ Aktif, dari .+!$/)
  expect(mine[0].phone).toBe(`62856${suffix}`)

  // Marking one sent moves the count without finishing the broadcast.
  expect((await api(page, 'PATCH', `/api/whatsapp/broadcasts/${id}`, { status: 'sent', recipient_ids: [mine[0].id] })).json.sent).toBe(1)
  let now = await api(page, 'GET', `/api/whatsapp/broadcasts/${id}`)
  expect(now.json.broadcast.sent_count).toBe(1)
  if (queue.json.counts.total > 1) expect(now.json.broadcast.status).toBe('draft')

  // Marking the rest finishes it.
  await api(page, 'PATCH', `/api/whatsapp/broadcasts/${id}`, { status: 'sent' })
  now = await api(page, 'GET', `/api/whatsapp/broadcasts/${id}`)
  expect(now.json.counts.pending).toBe(0)
  expect(now.json.broadcast.status).toBe('sent')
})
