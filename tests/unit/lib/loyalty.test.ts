import { calculateLoyaltyPoints } from '@/lib/utils/loyalty'

describe('calculateLoyaltyPoints', () => {
  it('earns points per whole thousand rupiah spent', () => {
    expect(calculateLoyaltyPoints(50_000, 1)).toBe(50)
  })

  it('rounds down a partial thousand — a Rp 999 sale earns nothing', () => {
    expect(calculateLoyaltyPoints(999, 1)).toBe(0)
  })

  it('a Rp 50,999 sale still only counts the whole 50 thousands', () => {
    expect(calculateLoyaltyPoints(50_999, 1)).toBe(50)
  })

  it('scales with the outlet\'s configured points-per-1000 rate', () => {
    expect(calculateLoyaltyPoints(100_000, 5)).toBe(500)
  })

  it('a rate of 0 (loyalty not configured) always earns 0', () => {
    expect(calculateLoyaltyPoints(1_000_000, 0)).toBe(0)
  })

  it('a total of 0 earns 0 regardless of rate', () => {
    expect(calculateLoyaltyPoints(0, 10)).toBe(0)
  })
})
