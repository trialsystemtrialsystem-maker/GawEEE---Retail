import { computePphFinal, parsePphSettings, DEFAULT_PPH } from '@/lib/utils/pphFinal'

describe('computePphFinal', () => {
  it('taxes nothing until cumulative turnover passes the Rp 500 juta exemption', () => {
    const r = computePphFinal(
      [
        { month: '2026-01', gross: 200_000_000 },
        { month: '2026-02', gross: 200_000_000 },
        { month: '2026-03', gross: 200_000_000 },
        { month: '2026-04', gross: 100_000_000 },
      ],
      DEFAULT_PPH
    )
    expect(r.map((m) => m.tax_due)).toEqual([0, 0, 500_000, 500_000])
    // March straddles the threshold: only the 100 juta above 500 juta is taxed.
    expect(r[2].taxable_turnover).toBe(100_000_000)
    expect(r[3].cumulative_turnover).toBe(700_000_000)
  })
  it('taxes every rupiah for entities (threshold 0)', () => {
    const r = computePphFinal([{ month: '2026-01', gross: 100_000_000 }], { enabled: true, rate_percent: 0.5, threshold: 0 })
    expect(r[0].tax_due).toBe(500_000)
  })
  it('is order-independent and can be switched off', () => {
    const months = [{ month: '2026-02', gross: 600_000_000 }, { month: '2026-01', gross: 100_000_000 }]
    expect(computePphFinal(months, DEFAULT_PPH).map((m) => m.month)).toEqual(['2026-01', '2026-02'])
    expect(computePphFinal(months, { ...DEFAULT_PPH, enabled: false }).every((m) => m.tax_due === 0)).toBe(true)
  })
})

describe('parsePphSettings', () => {
  it('defaults to the individual UMKM regime and ignores junk', () => {
    expect(parsePphSettings(undefined)).toEqual(DEFAULT_PPH)
    expect(parsePphSettings({ tax: { rate_percent: 'x', threshold: -5, enabled: 'yes' } })).toEqual(DEFAULT_PPH)
  })
  it('reads valid overrides and clamps the rate', () => {
    expect(parsePphSettings({ tax: { rate_percent: 1, threshold: 0, enabled: false } })).toEqual({ enabled: false, rate_percent: 1, threshold: 0 })
    expect(parsePphSettings({ tax: { rate_percent: 500 } }).rate_percent).toBe(100)
  })
})
