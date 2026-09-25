import { findConflicts, slotRange, toMinutes, type BookingSlot } from '@/lib/utils/bookingConflicts'

const slot = (o: Partial<BookingSlot>): BookingSlot => ({ scheduled_date: '2026-10-01', scheduled_start_time: '10:00', scheduled_end_time: '11:00', staff_id: null, facility_id: null, status: 'confirmed', ...o })

describe('time helpers', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('09:30:00')).toBe(570)
  })
  it('defaults the duration when there is no end time', () => {
    expect(slotRange(slot({ scheduled_end_time: null }))).toEqual([600, 660])
    expect(slotRange(slot({ scheduled_end_time: null }), 30)).toEqual([600, 630])
  })
})

describe('findConflicts', () => {
  const existing = [slot({ id: 'a', staff_id: 's1', facility_id: 'f1' })]
  it('flags overlapping bookings for the same staff or facility, with the reason', () => {
    expect(findConflicts(slot({ scheduled_start_time: '10:30', scheduled_end_time: '11:30', staff_id: 's1' }), existing)[0].reasons).toEqual(['staff'])
    expect(findConflicts(slot({ scheduled_start_time: '10:30', scheduled_end_time: '11:30', facility_id: 'f1' }), existing)[0].reasons).toEqual(['facility'])
    expect(findConflicts(slot({ scheduled_start_time: '10:30', scheduled_end_time: '11:30', staff_id: 's1', facility_id: 'f1' }), existing)[0].reasons).toEqual(['staff', 'facility'])
  })
  it('allows back-to-back bookings and different days', () => {
    expect(findConflicts(slot({ scheduled_start_time: '11:00', scheduled_end_time: '12:00', staff_id: 's1' }), existing)).toEqual([])
    expect(findConflicts(slot({ scheduled_date: '2026-10-02', staff_id: 's1' }), existing)).toEqual([])
  })
  it('ignores bookings needing different people/places, cancelled/no-show ones, and itself', () => {
    expect(findConflicts(slot({ staff_id: 's2', facility_id: 'f2' }), existing)).toEqual([])
    expect(findConflicts(slot({ staff_id: 's1' }), [slot({ id: 'x', staff_id: 's1', status: 'cancelled' }), slot({ id: 'y', staff_id: 's1', status: 'no_show' })])).toEqual([])
    expect(findConflicts(slot({ id: 'a', staff_id: 's1' }), existing)).toEqual([])
  })
  it('does not treat an unassigned booking as clashing with another unassigned one', () => {
    expect(findConflicts(slot({}), [slot({ id: 'z' })])).toEqual([])
  })
})
