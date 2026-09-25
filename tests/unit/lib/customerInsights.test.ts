import { customerSegment, normalizePhone, purchaseInterval, samePhone } from '@/lib/utils/customerInsights'

describe('normalizePhone / samePhone', () => {
  it('unifies Indonesian formats', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890')
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890')
    expect(normalizePhone('6281234567890')).toBe('6281234567890')
    expect(normalizePhone('81234567890')).toBe('6281234567890')
  })
  it('matches variants and never matches blanks or too-short values', () => {
    expect(samePhone('081234567890', '+6281234567890')).toBe(true)
    expect(samePhone('081234567890', '081234567891')).toBe(false)
    expect(samePhone('', '')).toBe(false)
    expect(samePhone(null, undefined)).toBe(false)
    expect(samePhone('123', '123')).toBe(false)
  })
})

describe('customerSegment', () => {
  it('buckets by recency, then value and frequency', () => {
    expect(customerSegment({ orders: 0, spend: 0, daysSinceLast: null })).toBe('inactive')
    expect(customerSegment({ orders: 5, spend: 500_000, daysSinceLast: 200 })).toBe('lost')
    expect(customerSegment({ orders: 5, spend: 500_000, daysSinceLast: 90 })).toBe('at_risk')
    expect(customerSegment({ orders: 2, spend: 3_000_000, daysSinceLast: 5 })).toBe('vip')
    expect(customerSegment({ orders: 4, spend: 400_000, daysSinceLast: 10 })).toBe('loyal')
    expect(customerSegment({ orders: 1, spend: 50_000, daysSinceLast: 3 })).toBe('new')
  })
  it('respects a custom VIP threshold', () => {
    expect(customerSegment({ orders: 1, spend: 600_000, daysSinceLast: 3, vipSpend: 500_000 })).toBe('vip')
  })
})

describe('purchaseInterval', () => {
  it('averages gaps and needs at least two purchases', () => {
    expect(purchaseInterval(['2026-01-01'])).toBeNull()
    expect(purchaseInterval(['2026-01-11', '2026-01-01', '2026-01-31'])).toBe(15)
  })
})
