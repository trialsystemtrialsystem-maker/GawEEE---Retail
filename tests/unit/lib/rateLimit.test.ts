import { evaluateRateLimit, clientIp } from '@/lib/utils/rateLimit'

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

describe('clientIp', () => {
  // A minimal fake rather than the real Request class — jsdom (this test
  // file's environment) doesn't polyfill it, and clientIp only ever reads
  // request.headers.get(name).
  function req(headers: Record<string, string>): Request {
    const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    return { headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null } } as unknown as Request
  }

  it('takes the first IP from a multi-hop x-forwarded-for chain', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' }))).toBe('203.0.113.5')
  })

  it('trims whitespace around the first x-forwarded-for entry', () => {
    expect(clientIp(req({ 'x-forwarded-for': '  203.0.113.5  , 70.41.3.18' }))).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
  })

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.5', 'x-real-ip': '198.51.100.7' }))).toBe('203.0.113.5')
  })

  it('degrades to a constant when neither header is present, rather than throwing', () => {
    expect(clientIp(req({}))).toBe('unknown')
  })
})
