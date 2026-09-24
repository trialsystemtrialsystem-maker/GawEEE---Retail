import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Needs migration 065: employee documents (with expiry alert feed) and
// performance reviews.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('documents (with expiry feed) and performance reviews', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id
  const created = await api(page, 'POST', '/api/staff', { outlet_id: outletId, first_name: 'E2E', last_name: 'Berkas', position: 'Kasir', hire_date: '2024-01-01', salary_amount: 1000000 })
  expect(created.status).toBe(201)
  const id: string = created.json.staff.id
  try {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    const doc = await api(page, 'POST', `/api/staff/${id}/documents`, { doc_type: 'kontrak', title: 'Kontrak E2E', expires_on: soon })
    expect(doc.status).toBe(201)
    const list = await api(page, 'GET', `/api/staff/${id}/history?type=documents`)
    expect(list.json.rows).toHaveLength(1)
    const expiring = await api(page, 'GET', `/api/staff/documents/expiring?outlet_id=${outletId}&days=60`)
    expect(expiring.json.documents.some((d: { id: string }) => d.id === doc.json.document.id)).toBe(true)
    expect((await api(page, 'POST', `/api/staff/${id}/documents`, { doc_type: 'kontrak', title: 'x' })).status).toBe(400)

    expect((await api(page, 'POST', `/api/staff/${id}/reviews`, { period_label: 'Semester 1 2026', overall_score: 4, ratings: { kedisiplinan: 5 }, strengths: 'Rajin' })).status).toBe(201)
    expect((await api(page, 'POST', `/api/staff/${id}/reviews`, { period_label: 'Semester 2 2026', overall_score: 9 })).status).toBe(400)
    const reviews = await api(page, 'GET', `/api/staff/${id}/history?type=reviews`)
    expect(reviews.json.rows).toHaveLength(1)
    expect(reviews.json.average_score).toBe(4)

    expect((await api(page, 'DELETE', `/api/staff/${id}/documents?document_id=${doc.json.document.id}`)).status).toBe(200)
  } finally {
    await api(page, 'DELETE', `/api/staff/${id}`)
  }
})
