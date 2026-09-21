import { resolveDateRange } from '@/lib/utils/dateRange'

describe('resolveDateRange', () => {
  it('uses explicit start/end verbatim when both are provided', () => {
    const params = new URLSearchParams({ start: '2026-01-05', end: '2026-01-20' })
    const range = resolveDateRange(params)
    expect(range.startDate).toBe('2026-01-05')
    expect(range.endDate).toBe('2026-01-20')
    expect(range.startIso).toBe('2026-01-05T00:00:00.000Z')
    expect(range.endIso).toBe('2026-01-20T23:59:59.999Z')
  })

  it('ignores a lone start or end without its pair, falling back to days', () => {
    const params = new URLSearchParams({ start: '2026-01-05' })
    const range = resolveDateRange(params, 7)
    const todayIso = new Date().toISOString().slice(0, 10)
    expect(range.endDate).toBe(todayIso)
    expect(range.startDate).not.toBe('2026-01-05')
  })

  it('falls back to a `days`-based window ending today when no explicit range is given', () => {
    const params = new URLSearchParams({ days: '7' })
    const range = resolveDateRange(params)
    const todayIso = new Date().toISOString().slice(0, 10)
    expect(range.endDate).toBe(todayIso)
    const spanDays = (new Date(range.endIso).getTime() - new Date(range.startIso).getTime()) / 86_400_000
    expect(Math.round(spanDays)).toBe(7)
  })

  it('uses defaultDays when neither start/end nor days is given', () => {
    const range = resolveDateRange(new URLSearchParams(), 30)
    const spanDays = (new Date(range.endIso).getTime() - new Date(range.startIso).getTime()) / 86_400_000
    expect(Math.round(spanDays)).toBe(30)
  })

  it('clamps an oversized `days` value to maxDays', () => {
    const params = new URLSearchParams({ days: '9999' })
    const range = resolveDateRange(params, 30, 365)
    const spanDays = (new Date(range.endIso).getTime() - new Date(range.startIso).getTime()) / 86_400_000
    expect(Math.round(spanDays)).toBe(365)
  })

  it('never produces a local-timezone-shifted boundary — start/end ISO strings always end exactly at 00:00:00.000Z / 23:59:59.999Z', () => {
    const params = new URLSearchParams({ start: '2026-06-15', end: '2026-06-15' })
    const range = resolveDateRange(params)
    expect(range.startIso.endsWith('T00:00:00.000Z')).toBe(true)
    expect(range.endIso.endsWith('T23:59:59.999Z')).toBe(true)
  })
})
