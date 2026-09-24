// Pure payslip composition — todo.md Phase 33 batch D. Turns the inputs of one
// employee's pay period into itemized lines plus the three stored totals.
// payslips.net_pay is generated as base + commission - deductions, so
// incentives (earnings) are folded into commission_amount and kasbon
// instalments into deductions; the items keep the real breakdown.

export interface PayslipItemDraft {
  kind: 'base' | 'commission' | 'incentive' | 'kasbon'
  label: string
  amount: number
  basis: Record<string, unknown>
}

export interface AdvanceInstallment {
  advance_id: string
  amount: number
  advance_date: string
}

export interface PayslipInput {
  base_salary: number
  sales: number
  commission_rate: number
  /** Auto + manual daily incentives inside the period. */
  incentives: { rule_name: string; amount: number }[]
  installments: AdvanceInstallment[]
}

export interface PayslipComposition {
  items: PayslipItemDraft[]
  base_salary: number
  commission_amount: number
  deductions: number
  net_pay: number
}

export function composePayslip(input: PayslipInput): PayslipComposition {
  const items: PayslipItemDraft[] = []
  const commission = Math.round(input.sales * input.commission_rate)

  items.push({ kind: 'base', label: 'Gaji pokok', amount: input.base_salary, basis: {} })
  if (commission > 0) {
    items.push({
      kind: 'commission',
      label: `Komisi ${(input.commission_rate * 100).toFixed(2).replace(/\.?0+$/, '')}% dari penjualan`,
      amount: commission,
      basis: { sales: input.sales, rate: input.commission_rate },
    })
  }

  const byRule = new Map<string, { amount: number; days: number }>()
  for (const i of input.incentives) {
    const e = byRule.get(i.rule_name) ?? { amount: 0, days: 0 }
    e.amount += i.amount
    e.days += 1
    byRule.set(i.rule_name, e)
  }
  let incentiveTotal = 0
  for (const [name, e] of byRule) {
    if (e.amount <= 0) continue
    incentiveTotal += e.amount
    items.push({ kind: 'incentive', label: `Insentif: ${name} (${e.days} hari)`, amount: e.amount, basis: { days: e.days } })
  }

  let deductions = 0
  for (const inst of input.installments) {
    if (inst.amount <= 0) continue
    deductions += inst.amount
    items.push({
      kind: 'kasbon',
      label: `Cicilan kasbon ${inst.advance_date}`,
      amount: inst.amount,
      basis: { advance_id: inst.advance_id },
    })
  }

  const commission_amount = commission + incentiveTotal
  return {
    items,
    base_salary: input.base_salary,
    commission_amount,
    deductions,
    net_pay: input.base_salary + commission_amount - deductions,
  }
}
