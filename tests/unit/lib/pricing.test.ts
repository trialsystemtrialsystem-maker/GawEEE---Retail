import { applyBulkChange, marginOf, roundPrice } from '@/lib/utils/pricing'

describe('roundPrice', () => {
  it('rounds to whole rupiah or the chosen step', () => {
    expect(roundPrice(1234.6)).toBe(1235)
    expect(roundPrice(12345, 500)).toBe(12500)
    expect(roundPrice(12249, 500)).toBe(12000)
    expect(roundPrice(12500, 1000)).toBe(13000)
  })
})

describe('marginOf', () => {
  it('is gross margin on selling price, null with no price', () => {
    expect(marginOf(70, 100)).toBeCloseTo(0.3)
    expect(marginOf(70, 0)).toBeNull()
  })
})

describe('applyBulkChange', () => {
  const p = { purchase_price: 7000, selling_price: 10000 }
  it('raises or lowers by a percent', () => {
    expect(applyBulkChange(p, { mode: 'percent', value: 10 }, 'selling_price').selling_price).toBe(11000)
    expect(applyBulkChange(p, { mode: 'percent', value: -5 }, 'selling_price').selling_price).toBe(9500)
    expect(applyBulkChange(p, { mode: 'percent', value: 10 }, 'purchase_price')).toEqual({ purchase_price: 7700, selling_price: 10000 })
  })
  it('adds an amount, sets an exact price, and rounds', () => {
    expect(applyBulkChange(p, { mode: 'amount', value: 1500 }, 'selling_price').selling_price).toBe(11500)
    expect(applyBulkChange(p, { mode: 'set', value: 9999 }, 'selling_price').selling_price).toBe(9999)
    expect(applyBulkChange({ purchase_price: 7000, selling_price: 10333 }, { mode: 'percent', value: 0 }, 'selling_price', 500).selling_price).toBe(10500)
  })
  it('sets the selling price for a target gross margin (always the selling field)', () => {
    expect(applyBulkChange(p, { mode: 'margin', value: 30 }, 'purchase_price')).toEqual({ purchase_price: 7000, selling_price: 10000 })
    expect(applyBulkChange(p, { mode: 'margin', value: 50 }, 'selling_price').selling_price).toBe(14000)
  })
  it('never goes negative and caps absurd margins', () => {
    expect(applyBulkChange(p, { mode: 'amount', value: -99999 }, 'selling_price').selling_price).toBe(0)
    expect(applyBulkChange(p, { mode: 'margin', value: 200 }, 'selling_price').selling_price).toBe(140000)
  })
})
