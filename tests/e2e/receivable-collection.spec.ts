import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Pay-later sales can now be collected in instalments: pending -> partial ->
// paid, each payment journaled, over-collection refused, and the invoice list's
// filters/summary reflect it. The invoice is voided at the end (which also
// reverses the instalment journals and restores stock).
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('collect a pay-later invoice in instalments', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const item = (await api(page, 'GET', `/api/inventory/${outletId}`)).json.inventory.find((i: { quantity_on_hand: number }) => i.quantity_on_hand > 5)
  const tag = `E2E-${Date.now()}`

  const sale = await api(page, 'POST', '/api/invoices', { outlet_id: outletId, customer_name: tag, customer_phone: '081200000001', items: [{ product_id: item.product_id, quantity: 1 }], payment_method: 'pay_later' })
  expect(sale.status).toBe(201)
  const id: string = sale.json.invoice_id
  const total: number = (await api(page, 'GET', `/api/invoices/${id}`)).json.invoice.total

  // Filters: it shows up under "belum lunas" and by search, not under "lunas".
  const unpaid = await api(page, 'GET', `/api/invoices?status=unpaid&search=${tag}`)
  expect(unpaid.json.invoices.map((i: { id: string }) => i.id)).toContain(id)
  expect(unpaid.json.summary.unpaid_total).toBeGreaterThanOrEqual(total)
  expect((await api(page, 'GET', `/api/invoices?status=paid&search=${tag}`)).json.invoices).toHaveLength(0)

  // Over-collecting and zero amounts are refused.
  expect((await api(page, 'POST', `/api/invoices/${id}/payments`, { payment_method: 'cash', amount: total + 1 })).status).toBe(400)
  expect((await api(page, 'POST', `/api/invoices/${id}/payments`, { payment_method: 'cash', amount: 0 })).status).toBe(400)

  const first = Math.floor(total / 2)
  const p1 = await api(page, 'POST', `/api/invoices/${id}/payments`, { payment_method: 'cash', amount: first })
  expect(p1.status).toBe(201)
  expect(p1.json.payment_status).toBe('partial')
  expect((await api(page, 'GET', `/api/invoices/${id}`)).json.invoice.payment_status).toBe('partial')

  // The receivables report shows only what is still owed.
  const ar = await api(page, 'GET', '/api/reports/accounts-receivable')
  const arRow = ar.json.invoices.find((i: { id: string }) => i.id === id)
  expect(arRow.balance).toBe(total - first)

  const p2 = await api(page, 'POST', `/api/invoices/${id}/payments`, { payment_method: 'bank_transfer', amount: total - first })
  expect(p2.status).toBe(201)
  expect(p2.json.payment_status).toBe('paid')
  const detail = await api(page, 'GET', `/api/invoices/${id}`)
  expect(detail.json.invoice.payment_status).toBe('paid')
  expect(detail.json.payments.filter((p: { status: string }) => p.status === 'settled')).toHaveLength(2)
  expect((await api(page, 'POST', `/api/invoices/${id}/payments`, { payment_method: 'cash', amount: 1 })).status).toBe(409)

  // Each instalment reached the books.
  const today = new Date().toISOString().slice(0, 10)
  const journals = await api(page, 'GET', `/api/accounting/journal-entries?outlet_id=${outletId}&start=${today}`)
  const collected = journals.json.entries.filter((e: { source_id: string; description: string }) => e.source_id === id && e.description.startsWith('Pelunasan piutang'))
  expect(collected.length).toBe(2)

  // Voiding reverses them along with the sale and restores stock.
  expect((await api(page, 'POST', `/api/invoices/${id}/void`, { reason: 'E2E piutang cleanup' })).status).toBe(200)
  const after = await api(page, 'GET', `/api/accounting/journal-entries?outlet_id=${outletId}&start=${today}`)
  const stillPosted = after.json.entries.filter((e: { source_id: string; status: string; description: string }) => e.source_id === id && e.status === 'posted' && !e.description?.startsWith('Pembatalan'))
  expect(stillPosted).toHaveLength(0)
  expect((await api(page, 'GET', `/api/invoices?status=voided&search=${tag}`)).json.summary.voided).toBe(1)
})
