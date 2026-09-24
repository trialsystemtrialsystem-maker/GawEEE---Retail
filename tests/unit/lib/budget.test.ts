import { budgetVariance } from '@/lib/utils/budget'

describe('budgetVariance', () => {
  it('expense under budget is ok, slightly over warns, far over is bad', () => {
    expect(budgetVariance('expense', 1000, 900).status).toBe('ok')
    expect(budgetVariance('expense', 1000, 1050).status).toBe('warn')
    expect(budgetVariance('expense', 1000, 1300).status).toBe('bad')
  })
  it('income below target is adverse, above is ok', () => {
    expect(budgetVariance('income', 1000, 1200).status).toBe('ok')
    expect(budgetVariance('income', 1000, 950).status).toBe('warn')
    expect(budgetVariance('income', 1000, 500).status).toBe('bad')
  })
  it('reports variance and pct, and null pct without a budget', () => {
    const v = budgetVariance('expense', 200, 250)
    expect(v.variance).toBe(50)
    expect(v.pct).toBeCloseTo(0.25)
    expect(budgetVariance('expense', 0, 100)).toMatchObject({ pct: null, status: 'bad' })
    expect(budgetVariance('income', 0, 0).status).toBe('none')
  })
})
