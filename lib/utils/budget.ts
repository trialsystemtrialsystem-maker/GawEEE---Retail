// Budget vs actual math for Anggaran. For an expense, spending above budget is
// bad; for income, earning below the target is bad.

export interface BudgetVariance {
  /** actual - budget (positive = more than planned). */
  variance: number
  /** variance as a share of budget; null when there is no budget. */
  pct: number | null
  status: 'ok' | 'warn' | 'bad' | 'none'
}

export function budgetVariance(type: 'income' | 'expense', budget: number, actual: number): BudgetVariance {
  const variance = Math.round((actual - budget) * 100) / 100
  if (budget <= 0) return { variance, pct: null, status: actual > 0 && type === 'expense' ? 'bad' : 'none' }
  const pct = variance / budget
  // Expense: within budget ok, up to 10% over warn, beyond bad. Income: mirror image.
  const adverse = type === 'expense' ? pct : -pct
  const status = adverse <= 0 ? 'ok' : adverse <= 0.1 ? 'warn' : 'bad'
  return { variance, pct, status }
}
