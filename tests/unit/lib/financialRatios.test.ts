import { computeRatios, formatRatio } from '@/lib/utils/financialRatios'

const base = { currentAssets: 200, inventory: 50, totalLiability: 100, totalEquity: 300, totalAsset: 400, revenue: 1000, cogs: 600, operatingExpense: 250, netProfit: 150 }
const get = (k: string, i = base) => computeRatios(i).find((r) => r.key === k)!

describe('financial ratios', () => {
  it('computes liquidity, leverage and margins', () => {
    expect(get('current').value).toBeCloseTo(2)
    expect(get('quick').value).toBeCloseTo(1.5)
    expect(get('dte').value).toBeCloseTo(1 / 3)
    expect(get('gross').value).toBeCloseTo(0.4)
    expect(get('opex').value).toBeCloseTo(0.25)
    expect(get('net').value).toBeCloseTo(0.15)
    expect(get('roa').value).toBeCloseTo(0.375)
  })
  it('returns null (not NaN/Infinity) when the denominator is zero', () => {
    const r = get('current', { ...base, totalLiability: 0 })
    expect(r.value).toBeNull()
    expect(formatRatio(r)).toBe('-')
    expect(get('gross', { ...base, revenue: 0 }).value).toBeNull()
  })
  it('formats ratios', () => {
    expect(formatRatio(get('current'))).toBe('2.00×')
    expect(formatRatio(get('gross'))).toBe('40.0%')
  })
})
