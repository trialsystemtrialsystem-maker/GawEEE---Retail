import { promoDiscount, promoStatus, generateCouponCode } from '@/lib/utils/promoRules'

describe('promoDiscount', () => {
  it('computes percentage and fixed', () => {
    expect(promoDiscount({ discount_type: 'percentage', discount_value: 10 }, 200_000)).toEqual({ ok: true, amount: 20_000 })
    expect(promoDiscount({ discount_type: 'fixed', discount_value: 15_000 }, 200_000)).toEqual({ ok: true, amount: 15_000 })
  })
  it('enforces minimum purchase', () => {
    const r = promoDiscount({ discount_type: 'fixed', discount_value: 5_000, min_purchase: 100_000 }, 99_999)
    expect(r.ok).toBe(false)
    expect(promoDiscount({ discount_type: 'fixed', discount_value: 5_000, min_purchase: 100_000 }, 100_000).ok).toBe(true)
  })
  it('caps percentage discounts and never exceeds the subtotal', () => {
    expect(promoDiscount({ discount_type: 'percentage', discount_value: 50, max_discount: 25_000 }, 200_000)).toEqual({ ok: true, amount: 25_000 })
    expect(promoDiscount({ discount_type: 'fixed', discount_value: 80_000 }, 50_000)).toEqual({ ok: true, amount: 50_000 })
  })
})

describe('promoStatus', () => {
  const today = '2026-06-15'
  it('classifies by flag, dates and usage', () => {
    expect(promoStatus({ is_active: false, start: '2026-06-01', end: '2026-06-30' }, today)).toBe('inactive')
    expect(promoStatus({ is_active: true, start: '2026-06-01', end: '2026-06-14' }, today)).toBe('expired')
    expect(promoStatus({ is_active: true, start: '2026-06-16', end: '2026-06-30' }, today)).toBe('scheduled')
    expect(promoStatus({ is_active: true, start: '2026-06-01', end: '2026-06-15' }, today)).toBe('active')
    expect(promoStatus({ is_active: true, usage_limit: 3, usage_count: 3 }, today)).toBe('exhausted')
    expect(promoStatus({ is_active: true, expires: undefined, usage_limit: null } as never, today)).toBe('active')
  })
})

describe('generateCouponCode', () => {
  it('uses a clean prefix and unambiguous characters', () => {
    const code = generateCouponCode('ha-ri', 6, () => 0)
    expect(code).toBe('HARIAAAAAA')
    expect(generateCouponCode('', 8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })
})
