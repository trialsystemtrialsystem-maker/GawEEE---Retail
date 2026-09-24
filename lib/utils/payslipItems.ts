// Pure payslip composition — todo.md Phase 33 batch D (+ payroll rules).
// Turns the inputs of one employee's pay period into itemized lines plus the
// three stored totals. payslips.net_pay is generated as
// base + commission - deductions, so every earning other than base is folded
// into commission_amount and every deduction into deductions; the items keep
// the real breakdown.
import { EMPTY_PAYROLL_RULES, type PayrollRules } from '@/lib/utils/payrollRules'

export type PayslipItemKind = 'base' | 'commission' | 'incentive' | 'bonus' | 'late_penalty' | 'absence' | 'kasbon' | 'other_deduction'

/** Kinds that reduce take-home pay. */
export const DEDUCTION_KINDS: readonly PayslipItemKind[] = ['late_penalty', 'absence', 'kasbon', 'other_deduction']
export const isDeductionKind = (kind: string) => (DEDUCTION_KINDS as readonly string[]).includes(kind)

export interface PayslipItemDraft {
  kind: PayslipItemKind
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
  rules?: PayrollRules
  /** Attendance facts for the period; only used when a rule needs them. */
  attendance?: { late_minutes: number; overtime_minutes: number; absent_days: number }
}

export interface PayslipComposition {
  items: PayslipItemDraft[]
  base_salary: number
  commission_amount: number
  deductions: number
  net_pay: number
}

const rp = (n: number) => Math.round(n)

export function composePayslip(input: PayslipInput): PayslipComposition {
  const rules = input.rules ?? EMPTY_PAYROLL_RULES
  const att = input.attendance ?? { late_minutes: 0, overtime_minutes: 0, absent_days: 0 }
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

  let earnings = commission

  const byRule = new Map<string, { amount: number; days: number }>()
  for (const i of input.incentives) {
    const e = byRule.get(i.rule_name) ?? { amount: 0, days: 0 }
    e.amount += i.amount
    e.days += 1
    byRule.set(i.rule_name, e)
  }
  for (const [name, e] of byRule) {
    if (e.amount <= 0) continue
    earnings += e.amount
    items.push({ kind: 'incentive', label: `Insentif: ${name} (${e.days} hari)`, amount: e.amount, basis: { days: e.days } })
  }

  for (const a of rules.allowances) {
    earnings += a.amount
    items.push({ kind: 'bonus', label: `Tunjangan: ${a.label}`, amount: a.amount, basis: {} })
  }

  const overtimePay = rp((att.overtime_minutes / 60) * rules.overtime_per_hour)
  if (overtimePay > 0) {
    earnings += overtimePay
    items.push({
      kind: 'bonus',
      label: `Lembur ${Math.floor(att.overtime_minutes / 60)} jam ${att.overtime_minutes % 60} menit`,
      amount: overtimePay,
      basis: { overtime_minutes: att.overtime_minutes, rate_per_hour: rules.overtime_per_hour },
    })
  }

  let deductions = 0
  // Deductions are applied in order and never push take-home pay below zero
  // (later ones, e.g. kasbon instalments, simply collect less this period).
  const deduct = (kind: PayslipItemKind, label: string, wanted: number, basis: Record<string, unknown>) => {
    const amount = Math.min(wanted, input.base_salary + earnings - deductions)
    if (amount <= 0) return
    deductions += amount
    items.push({ kind, label, amount, basis })
  }

  deduct('late_penalty', `Potongan terlambat ${att.late_minutes} menit`, rp(att.late_minutes * rules.late_penalty_per_minute), {
    late_minutes: att.late_minutes,
    rate_per_minute: rules.late_penalty_per_minute,
  })
  deduct('absence', `Potongan absen ${att.absent_days} hari`, rp(att.absent_days * rules.absence_deduction_per_day), {
    absent_days: att.absent_days,
    rate_per_day: rules.absence_deduction_per_day,
  })
  for (const d of rules.percent_deductions) {
    deduct('other_deduction', `${d.label} (${d.percent}% gaji pokok)`, rp((input.base_salary * d.percent) / 100), { percent: d.percent })
  }
  for (const inst of input.installments) {
    deduct('kasbon', `Cicilan kasbon ${inst.advance_date}`, inst.amount, { advance_id: inst.advance_id })
  }

  return {
    items,
    base_salary: input.base_salary,
    commission_amount: earnings,
    deductions,
    net_pay: input.base_salary + earnings - deductions,
  }
}
