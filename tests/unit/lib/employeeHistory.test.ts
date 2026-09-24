import { lateMinutes, workedMinutes, leaveDaysWithin, tenureLabel, formatDuration } from '@/lib/utils/employeeHistory'

describe('lateMinutes', () => {
  it('is 0 when clocking in exactly at shift start (WIB)', () => {
    expect(lateMinutes('2026-09-01T01:00:00Z', '08:00:00')).toBe(0) // 01:00Z = 08:00 WIB
  })
  it('counts minutes after the shift start', () => {
    expect(lateMinutes('2026-09-01T01:25:00Z', '08:00:00')).toBe(25)
  })
  it('is 0 when early', () => {
    expect(lateMinutes('2026-09-01T00:40:00Z', '08:00:00')).toBe(0)
  })
  it('is 0 without a schedule or clock-in', () => {
    expect(lateMinutes(null, '08:00:00')).toBe(0)
    expect(lateMinutes('2026-09-01T01:25:00Z', null)).toBe(0)
  })
  it('handles the UTC/WIB day boundary (17:30Z = 00:30 next day WIB)', () => {
    expect(lateMinutes('2026-09-01T17:30:00Z', '00:00:00')).toBe(30)
  })
})

describe('workedMinutes / formatDuration', () => {
  it('computes whole minutes between in and out', () => {
    expect(workedMinutes('2026-09-01T01:00:00Z', '2026-09-01T09:30:00Z')).toBe(510)
  })
  it('is 0 for missing or inverted times', () => {
    expect(workedMinutes(null, '2026-09-01T09:30:00Z')).toBe(0)
    expect(workedMinutes('2026-09-01T09:30:00Z', '2026-09-01T01:00:00Z')).toBe(0)
  })
  it('formats durations', () => {
    expect(formatDuration(510)).toBe('8 jam 30 menit')
    expect(formatDuration(25)).toBe('25 menit')
  })
})

describe('leaveDaysWithin', () => {
  it('counts a fully inside request inclusively', () => {
    expect(leaveDaysWithin('2026-09-10', '2026-09-12', '2026-09-01', '2026-09-30')).toBe(3)
  })
  it('clips a request that spills over the range', () => {
    expect(leaveDaysWithin('2026-08-30', '2026-09-03', '2026-09-01', '2026-09-30')).toBe(3)
  })
  it('is 0 when outside the range', () => {
    expect(leaveDaysWithin('2026-08-01', '2026-08-05', '2026-09-01', '2026-09-30')).toBe(0)
  })
})

describe('tenureLabel', () => {
  const today = new Date('2026-09-24T00:00:00Z')
  it('shows years and months', () => {
    expect(tenureLabel('2024-03-10', today)).toBe('2 tahun 6 bulan')
  })
  it('shows only months under a year', () => {
    expect(tenureLabel('2026-05-01', today)).toBe('4 bulan')
  })
  it('does not count an unfinished month', () => {
    expect(tenureLabel('2026-08-30', today)).toBe('0 bulan')
  })
})
