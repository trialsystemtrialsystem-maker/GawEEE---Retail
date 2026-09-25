import { checkDiscounts, grantedDiscount, type DiscountInput } from '@/lib/utils/discountRules'

const base: DiscountInput = { gross_subtotal: 100_000, line_discounts: 0, discount_amount: 0, claims: [], role: 'cashier', max_unexplained_percent: 30 }

describe('grantedDiscount', () => {
  it('computes percentage and fixed grants, capped at the subtotal', () => {
    expect(grantedDiscount(100_000, 'percentage', 10)).toBe(10_000)
    expect(grantedDiscount(100_000, 'fixed', 15_000)).toBe(15_000)
    expect(grantedDiscount(50_000, 'fixed', 80_000)).toBe(50_000)
    expect(grantedDiscount(100_000, 'percentage', -5)).toBe(0)
  })
})

describe('checkDiscounts', () => {
  it('accepts no discount and a legitimately claimed promotion', () => {
    expect(checkDiscounts(base)).toEqual({ ok: true, unexplained: 0 })
    expect(checkDiscounts({ ...base, discount_amount: 10_000, claims: [{ claimed: 10_000, max: 10_000, label: 'promo' }] })).toEqual({ ok: true, unexplained: 0 })
  })

  it('rejects a component claimed above what it could grant', () => {
    const r = checkDiscounts({ ...base, discount_amount: 60_000, claims: [{ claimed: 60_000, max: 10_000, label: 'promo' }] })
    expect(r.ok).toBe(false)
  })

  it('never lets discounts exceed the subtotal, even for managers', () => {
    expect(checkDiscounts({ ...base, role: 'master_admin', discount_amount: 100_002 }).ok).toBe(false)
    expect(checkDiscounts({ ...base, role: 'outlet_manager', discount_amount: 100_000 }).ok).toBe(true)
    expect(checkDiscounts({ ...base, role: 'outlet_manager', line_discounts: 60_000, discount_amount: 50_000 }).ok).toBe(false)
  })

  it('caps unexplained discount for cashier/staff but not managers', () => {
    expect(checkDiscounts({ ...base, discount_amount: 30_000 }).ok).toBe(true)
    expect(checkDiscounts({ ...base, discount_amount: 45_000 }).ok).toBe(false)
    expect(checkDiscounts({ ...base, role: 'staff', discount_amount: 45_000 }).ok).toBe(false)
    expect(checkDiscounts({ ...base, role: 'outlet_manager', discount_amount: 45_000 }).ok).toBe(true)
  })

  it('counts explained components against the claim, only the remainder against the cap', () => {
    // 20% promo (20k) + 25k unexplained -> unexplained 25k <= 30k cap
    expect(checkDiscounts({ ...base, discount_amount: 45_000, claims: [{ claimed: 20_000, max: 20_000, label: 'promo' }] })).toEqual({ ok: true, unexplained: 25_000 })
    // ...but 35k unexplained is over the cap
    expect(checkDiscounts({ ...base, discount_amount: 55_000, claims: [{ claimed: 20_000, max: 20_000, label: 'promo' }] }).ok).toBe(false)
  })

  it('honours a custom cap', () => {
    expect(checkDiscounts({ ...base, max_unexplained_percent: 5, discount_amount: 6_000 }).ok).toBe(false)
    expect(checkDiscounts({ ...base, max_unexplained_percent: 100, discount_amount: 100_000 }).ok).toBe(true)
  })
})
