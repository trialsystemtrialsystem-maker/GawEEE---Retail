import { outstandingBalance, nextInstallment, isFullyRepaid } from '@/lib/utils/cashAdvance'

const adv = (over: Partial<{ amount: number; status: string; repay_per_period: number }> = {}) => ({ amount: 1_000_000, status: 'paid_out', repay_per_period: 250_000, ...over })

describe('outstandingBalance', () => {
  it('is the amount minus repayments once paid out', () => {
    expect(outstandingBalance(adv(), 300_000)).toBe(700_000)
  })
  it('is 0 while pending/approved/rejected (no debt yet)', () => {
    for (const status of ['pending', 'approved', 'rejected']) expect(outstandingBalance(adv({ status }), 0)).toBe(0)
  })
  it('never goes negative on over-repayment', () => {
    expect(outstandingBalance(adv(), 1_200_000)).toBe(0)
  })
})

describe('nextInstallment', () => {
  it('deducts the configured per-period amount', () => {
    expect(nextInstallment(adv(), 0)).toBe(250_000)
  })
  it('is capped at the remaining balance', () => {
    expect(nextInstallment(adv(), 900_000)).toBe(100_000)
  })
  it('deducts everything left when no per-period amount is set', () => {
    expect(nextInstallment(adv({ repay_per_period: 0 }), 400_000)).toBe(600_000)
  })
  it('is 0 when nothing is owed', () => {
    expect(nextInstallment(adv({ status: 'repaid' }), 1_000_000)).toBe(0)
  })
})

describe('isFullyRepaid', () => {
  it('detects exact and over repayment', () => {
    expect(isFullyRepaid(1_000_000, 1_000_000)).toBe(true)
    expect(isFullyRepaid(1_000_000, 999_999.999)).toBe(true)
    expect(isFullyRepaid(1_000_000, 900_000)).toBe(false)
  })
})
