import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// Bookings: double-booking protection (same facility/staff), back-to-back is
// fine, cancelled / no-show bookings free their slot, edits are re-checked, and
// the list is windowed by date.
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => ({})) }
    },
    { method, url, body }
  )
}

test('bookings prevent double-booking and free slots on cancel/no-show', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  const outletId: string = (await api(page, 'GET', '/api/outlets')).json.own_outlet_id

  const facilities = (await api(page, 'GET', `/api/facilities?outlet_id=${outletId}`)).json.facilities as { id: string }[]
  const facilityId: string = facilities?.[0]?.id ?? (await api(page, 'POST', '/api/facilities', { outlet_id: outletId, name: 'E2E Ruang' })).json.facility.id

  const day = 1 + (Date.now() % 27)
  const date = `2031-07-${String(day).padStart(2, '0')}`
  const base = { outlet_id: outletId, customer_name: `E2E Booking ${Date.now()}`, item_description: 'Uji jadwal', facility_id: facilityId, scheduled_date: date }
  const ids: string[] = []

  const a = await api(page, 'POST', '/api/bookings', { ...base, scheduled_start_time: '10:00', scheduled_end_time: '11:00' })
  expect(a.status).toBe(201)
  ids.push(a.json.booking.id)

  const clash = await api(page, 'POST', '/api/bookings', { ...base, scheduled_start_time: '10:30', scheduled_end_time: '11:30' })
  expect(clash.status).toBe(409)
  expect(clash.json.error).toContain('Bentrok')

  const c = await api(page, 'POST', '/api/bookings', { ...base, scheduled_start_time: '11:00', scheduled_end_time: '12:00' })
  expect(c.status).toBe(201) // back-to-back is fine
  ids.push(c.json.booking.id)

  // Moving it onto A's slot is re-checked.
  expect((await api(page, 'PATCH', `/api/bookings/${c.json.booking.id}`, { scheduled_start_time: '10:30', scheduled_end_time: '11:30' })).status).toBe(409)

  // Cancelling records the reason and frees the slot for its own time only.
  const cancelled = await api(page, 'PATCH', `/api/bookings/${c.json.booking.id}`, { status: 'cancelled', cancel_reason: 'pelanggan batal' })
  expect(cancelled.status).toBe(200)
  expect(cancelled.json.booking.notes).toContain('Dibatalkan: pelanggan batal')
  expect((await api(page, 'PATCH', `/api/bookings/${c.json.booking.id}`, { notes: 'ubah lagi' })).status).toBe(409) // closed bookings are read-only

  // A no-show frees A's slot, so the previously clashing booking now fits.
  expect((await api(page, 'PATCH', `/api/bookings/${a.json.booking.id}`, { status: 'no_show' })).status).toBe(200)
  const b = await api(page, 'POST', '/api/bookings', { ...base, scheduled_start_time: '10:30', scheduled_end_time: '11:30' })
  expect(b.status).toBe(201)
  ids.push(b.json.booking.id)

  // The list is windowed by date and filterable by status.
  const day1 = await api(page, 'GET', `/api/bookings?outlet_id=${outletId}&start=${date}&end=${date}`)
  expect(day1.json.bookings.map((x: { id: string }) => x.id).sort()).toEqual([...ids].sort())
  const cancelledOnly = await api(page, 'GET', `/api/bookings?outlet_id=${outletId}&start=${date}&end=${date}&status=cancelled`)
  expect(cancelledOnly.json.bookings).toHaveLength(1)
  expect((await api(page, 'GET', `/api/bookings?outlet_id=${outletId}&start=2031-01-01&end=2031-01-02`)).json.bookings.some((x: { id: string }) => ids.includes(x.id))).toBe(false)

  // Leave nothing active behind.
  await api(page, 'PATCH', `/api/bookings/${b.json.booking.id}`, { status: 'cancelled', cancel_reason: 'E2E cleanup' })
})
