import { composePayslip } from '@/lib/utils/payslipItems'

describe('composePayslip', () => {
  it('equals the legacy base + commission when there are no incentives or kasbon', () => {
    const r = composePayslip({ base_salary: 3_000_000, sales: 10_000_000, commission_rate: 0.02, incentives: [], installments: [] })
    expect(r.commission_amount).toBe(200_000)
    expect(r.deductions).toBe(0)
    expect(r.net_pay).toBe(3_200_000)
    expect(r.items.map((i) => i.kind)).toEqual(['base', 'commission'])
  })

  it('folds incentives into earnings and kasbon into deductions', () => {
    const r = composePayslip({
      base_salary: 2_000_000,
      sales: 0,
      commission_rate: 0.02,
      incentives: [
        { rule_name: 'Hadir', amount: 10_000 },
        { rule_name: 'Hadir', amount: 10_000 },
        { rule_name: 'Target', amount: 50_000 },
      ],
      installments: [{ advance_id: 'a1', amount: 300_000, advance_date: '2026-09-01' }],
    })
    expect(r.commission_amount).toBe(70_000)
    expect(r.deductions).toBe(300_000)
    expect(r.net_pay).toBe(2_000_000 + 70_000 - 300_000)
    const inc = r.items.filter((i) => i.kind === 'incentive')
    expect(inc).toHaveLength(2)
    expect(inc.find((i) => i.label.includes('Hadir'))?.amount).toBe(20_000)
    expect(r.items.filter((i) => i.kind === 'kasbon')).toHaveLength(1)
  })

  it('item earnings minus deductions always equal net_pay', () => {
    const r = composePayslip({
      base_salary: 1_500_000,
      sales: 3_333_333,
      commission_rate: 0.015,
      incentives: [{ rule_name: 'X', amount: 7_000 }],
      installments: [{ advance_id: 'a', amount: 100_000, advance_date: '2026-09-02' }],
    })
    const earn = r.items.filter((i) => i.kind !== 'kasbon').reduce((s, i) => s + i.amount, 0)
    const ded = r.items.filter((i) => i.kind === 'kasbon').reduce((s, i) => s + i.amount, 0)
    expect(earn - ded).toBe(r.net_pay)
  })
})

describe('composePayslip with payroll rules', () => {
  const rules = { late_penalty_per_minute: 1000, overtime_per_hour: 20000, absence_deduction_per_day: 50000, allowances: [{ label: 'Transport', amount: 100000 }], percent_deductions: [{ label: 'BPJS', percent: 2 }] }
  it('applies allowance, overtime, late, absence and percent deductions', () => {
    const r = composePayslip({
      base_salary: 2_000_000, sales: 0, commission_rate: 0, incentives: [], installments: [], rules,
      attendance: { late_minutes: 30, overtime_minutes: 90, absent_days: 1 },
    })
    // earnings: 100k + overtime 30k; deductions: 30k late + 50k absen + 40k BPJS
    expect(r.commission_amount).toBe(130_000)
    expect(r.deductions).toBe(120_000)
    expect(r.net_pay).toBe(2_000_000 + 130_000 - 120_000)
  })
  it('never lets deductions push net pay below zero', () => {
    const r = composePayslip({
      base_salary: 100_000, sales: 0, commission_rate: 0, incentives: [], rules: { ...rules, allowances: [], absence_deduction_per_day: 0 },
      installments: [{ advance_id: 'a', amount: 999_999, advance_date: '2026-01-01' }],
      attendance: { late_minutes: 0, overtime_minutes: 0, absent_days: 0 },
    })
    expect(r.net_pay).toBe(0)
    expect(r.items.find((i) => i.kind === 'kasbon')?.amount).toBe(98_000)
  })
})
