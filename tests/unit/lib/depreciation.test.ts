import { bookValue, depreciationForMonth, monthNumber, type AssetLike } from '@/lib/utils/depreciation'

const asset: AssetLike = { cost: 12_000_000, salvage_value: 0, useful_life_months: 12, acquisition_date: '2026-03-15', status: 'active' }

describe('straight-line depreciation', () => {
  it('numbers months from the acquisition month', () => {
    expect(monthNumber(asset, '2026-03-01')).toBe(1)
    expect(monthNumber(asset, '2026-05-01')).toBe(3)
    expect(monthNumber(asset, '2026-02-01')).toBe(0)
  })
  it('depreciates an equal amount each month', () => {
    expect(depreciationForMonth(asset, '2026-03-01', 0)).toBe(1_000_000)
    expect(depreciationForMonth(asset, '2026-04-01', 1_000_000)).toBe(1_000_000)
  })
  it('does nothing before acquisition, after the useful life, or when not active', () => {
    expect(depreciationForMonth(asset, '2026-02-01', 0)).toBe(0)
    expect(depreciationForMonth(asset, '2027-03-01', 12_000_000)).toBe(0)
    expect(depreciationForMonth({ ...asset, status: 'disposed' }, '2026-04-01', 0)).toBe(0)
  })
  it('respects salvage value and lands exactly on the base with rounding', () => {
    const a: AssetLike = { cost: 1_000_000, salvage_value: 100_000, useful_life_months: 7, acquisition_date: '2026-01-01', status: 'active' }
    let total = 0
    for (let m = 1; m <= 7; m++) total += depreciationForMonth(a, `2026-${String(m).padStart(2, '0')}-01`, total)
    expect(Math.round(total * 100) / 100).toBe(900_000)
    expect(bookValue(a, total)).toBe(100_000)
  })
  it('never depreciates below salvage even if asked again', () => {
    expect(depreciationForMonth(asset, '2026-04-01', 12_000_000)).toBe(0)
  })
})
