import { computeIncentives, wibDayBounds, type IncentiveRuleLike } from '@/lib/utils/incentives'

const rules: IncentiveRuleLike[] = [
  { id: 'r1', name: 'Target Omzet 1jt', metric: 'sales_target', threshold: 1_000_000, amount: 50_000 },
  { id: 'r2', name: '20 Transaksi', metric: 'transactions', threshold: 20, amount: 25_000 },
  { id: 'r3', name: 'Tepat Waktu', metric: 'attendance_bonus', threshold: 0, amount: 10_000 },
]
const day = (over = {}) => ({ revenue: 0, transactions: 0, attended: false, late_minutes: 0, ...over })

describe('computeIncentives', () => {
  it('pays nothing on a quiet, absent day', () => {
    expect(computeIncentives(rules, day())).toEqual([])
  })
  it('pays the sales target only when revenue reaches the threshold', () => {
    expect(computeIncentives(rules, day({ revenue: 999_999 }))).toEqual([])
    const hit = computeIncentives(rules, day({ revenue: 1_000_000 }))
    expect(hit.map((r) => r.rule_id)).toEqual(['r1'])
    expect(hit[0].basis).toEqual({ metric: 'sales_target', threshold: 1_000_000, achieved: 1_000_000 })
  })
  it('pays the transaction-count rule at the threshold', () => {
    expect(computeIncentives(rules, day({ transactions: 20 })).map((r) => r.rule_id)).toEqual(['r2'])
  })
  it('pays the attendance bonus only when present and not late', () => {
    expect(computeIncentives(rules, day({ attended: true })).map((r) => r.rule_id)).toEqual(['r3'])
    expect(computeIncentives(rules, day({ attended: true, late_minutes: 5 }))).toEqual([])
    expect(computeIncentives(rules, day({ attended: false }))).toEqual([])
  })
  it('stacks every rule that is met', () => {
    const all = computeIncentives(rules, day({ revenue: 2_000_000, transactions: 30, attended: true }))
    expect(all.reduce((s, r) => s + r.amount, 0)).toBe(85_000)
  })
  it('a target of 0 does not pay out on zero sales', () => {
    const zero: IncentiveRuleLike[] = [{ id: 'z', name: 'x', metric: 'sales_target', threshold: 0, amount: 1 }]
    expect(computeIncentives(zero, day())).toEqual([])
  })
})

describe('wibDayBounds', () => {
  it('a WIB day starts at 17:00Z the previous UTC day', () => {
    expect(wibDayBounds('2026-09-24').startIso).toBe('2026-09-23T17:00:00.000Z')
    expect(wibDayBounds('2026-09-24').endIso).toBe('2026-09-24T16:59:59.999Z')
  })
})
