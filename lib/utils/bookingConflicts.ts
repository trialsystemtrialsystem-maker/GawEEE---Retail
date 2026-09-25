// Double-booking detection for Bookings. Two bookings clash when they are on the
// same date, their time ranges overlap, and they need the same person or the
// same facility. Cancelled and no-show bookings free their slot. A booking
// without an end time is assumed to last `defaultMinutes`.

export interface BookingSlot {
  id?: string
  scheduled_date: string
  scheduled_start_time: string // "HH:MM" or "HH:MM:SS"
  scheduled_end_time: string | null
  staff_id: string | null
  facility_id: string | null
  status?: string
}

export const FREE_STATUSES = ['cancelled', 'no_show']

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function slotRange(b: BookingSlot, defaultMinutes = 60): [number, number] {
  const start = toMinutes(b.scheduled_start_time)
  const end = b.scheduled_end_time ? toMinutes(b.scheduled_end_time) : start + defaultMinutes
  return [start, Math.max(end, start + 1)]
}

export type ConflictReason = 'staff' | 'facility'

export function findConflicts<T extends BookingSlot>(candidate: BookingSlot, existing: T[], defaultMinutes = 60): { booking: T; reasons: ConflictReason[] }[] {
  const [cs, ce] = slotRange(candidate, defaultMinutes)
  const out: { booking: T; reasons: ConflictReason[] }[] = []
  for (const e of existing) {
    if (e.id && e.id === candidate.id) continue
    if (e.scheduled_date !== candidate.scheduled_date) continue
    if (FREE_STATUSES.includes(e.status ?? '')) continue
    const [es, ee] = slotRange(e, defaultMinutes)
    if (!(cs < ee && es < ce)) continue
    const reasons: ConflictReason[] = []
    if (candidate.staff_id && e.staff_id === candidate.staff_id) reasons.push('staff')
    if (candidate.facility_id && e.facility_id === candidate.facility_id) reasons.push('facility')
    if (reasons.length) out.push({ booking: e, reasons })
  }
  return out
}
