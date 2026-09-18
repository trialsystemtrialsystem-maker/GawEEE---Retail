import { evaluateRateLimit } from '@/lib/utils/rateLimit'

describe('evaluateRateLimit', () => {
  const now = new Date('2026-01-01T12:00:00Z').getTime()

  it('allows a brand new key (no existing row)', () => {
    const decision = evaluateRateLimit(null, now, 10, 60)
    expect(decision.action).toBe('allow_new')
  })

  it('allows and increments while under the limit within the window', () => {
    const existing = { count: 3, window_start: new Date(now - 10_000).toISOString() }
    const decision = evaluateRateLimit(existing, now, 10, 60)
    expect(decision.action).toBe('allow_increment')
  })

  it('denies once the count reaches the max within the window', () => {
    const existing = { count: 10, window_start: new Date(now - 10_000).toISOString() }
    const decision = evaluateRateLimit(existing, now, 10, 60)
    expect(decision.action).toBe('deny')
    if (decision.action === 'deny') {
      expect(decision.retryAfterSeconds).toBeGreaterThan(0)
      expect(decision.retryAfterSeconds).toBeLessThanOrEqual(60)
    }
  })

  it('resets once the window has elapsed, even if the count was maxed out', () => {
    const existing = { count: 10, window_start: new Date(now - 61_000).toISOString() }
    const decision = evaluateRateLimit(existing, now, 10, 60)
    expect(decision.action).toBe('allow_reset')
  })

  it('retryAfterSeconds shrinks as the window elapses', () => {
    const early = evaluateRateLimit({ count: 10, window_start: new Date(now - 5_000).toISOString() }, now, 10, 60)
    const late = evaluateRateLimit({ count: 10, window_start: new Date(now - 55_000).toISOString() }, now, 10, 60)
    if (early.action === 'deny' && late.action === 'deny') {
      expect(late.retryAfterSeconds).toBeLessThan(early.retryAfterSeconds)
    } else {
      throw new Error('expected both to deny')
    }
  })
})
