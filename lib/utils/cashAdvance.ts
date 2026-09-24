// Pure kasbon (cash advance) math — todo.md Phase 33. Kept separate from the
// routes so payroll and the UI compute outstanding balances identically.

export interface AdvanceLike {
  amount: number
  status: string
  repay_per_period: number
}

/** What's still owed on an advance. An advance only carries a balance once
 * it has actually been paid out (approved-but-not-yet-handed-over money
 * isn't a debt yet); rejected/pending advances owe nothing. */
export function outstandingBalance(advance: AdvanceLike, repaid: number): number {
  if (advance.status !== 'paid_out') return 0
  return Math.max(0, Math.round((advance.amount - repaid) * 100) / 100)
}

/** The instalment to deduct in the next payroll run: the configured amount
 * per period (capped at what's left), or the whole remaining balance when no
 * per-period amount was set. */
export function nextInstallment(advance: AdvanceLike, repaid: number): number {
  const outstanding = outstandingBalance(advance, repaid)
  if (outstanding <= 0) return 0
  return advance.repay_per_period > 0 ? Math.min(advance.repay_per_period, outstanding) : outstanding
}

export function isFullyRepaid(amount: number, repaid: number): boolean {
  return repaid + 0.005 >= amount
}
