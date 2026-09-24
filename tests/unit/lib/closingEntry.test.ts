import { buildClosingLines } from '@/lib/utils/closingEntry'

const sum = (lines: { debit?: number; credit?: number }[], k: 'debit' | 'credit') => lines.reduce((s, l) => s + (l[k] ?? 0), 0)

describe('buildClosingLines', () => {
  it('zeroes income and expense and moves profit to Laba Ditahan', () => {
    const r = buildClosingLines([
      { account_code: '4000', account_type: 'income', balance: 1000 },
      { account_code: '5000', account_type: 'expense', balance: 600 },
      { account_code: '5100', account_type: 'expense', balance: 150 },
    ])
    expect(r.netProfit).toBe(250)
    expect(sum(r.lines, 'debit')).toBe(sum(r.lines, 'credit'))
    expect(r.lines.find((l) => l.code === '3100')).toMatchObject({ credit: 250 })
  })
  it('debits Laba Ditahan on a loss and still balances', () => {
    const r = buildClosingLines([
      { account_code: '4000', account_type: 'income', balance: 100 },
      { account_code: '5100', account_type: 'expense', balance: 400 },
    ])
    expect(r.netProfit).toBe(-300)
    expect(r.lines.find((l) => l.code === '3100')).toMatchObject({ debit: 300 })
    expect(sum(r.lines, 'debit')).toBe(sum(r.lines, 'credit'))
  })
  it('skips zero balances and returns no lines when there is no activity', () => {
    expect(buildClosingLines([{ account_code: '4000', account_type: 'income', balance: 0 }]).lines).toEqual([])
  })
  it('handles accounts that ended on the wrong side', () => {
    const r = buildClosingLines([
      { account_code: '4000', account_type: 'income', balance: 500 },
      { account_code: '5200', account_type: 'expense', balance: -50 },
    ])
    expect(r.netProfit).toBe(550)
    expect(sum(r.lines, 'debit')).toBe(sum(r.lines, 'credit'))
  })
})
