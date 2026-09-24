// Company payroll rules (Master Admin > Aturan Penggajian), stored at
// companies.settings.payroll. Every value defaults to 0/empty, so payroll
// behaves exactly as before until an owner opts in.

export interface PayrollRules {
  /** Rp deducted per minute a clock-in is after shift start. */
  late_penalty_per_minute: number
  /** Rp paid per full hour worked past shift end. */
  overtime_per_hour: number
  /** Rp deducted per day marked absent. */
  absence_deduction_per_day: number
  /** Fixed monthly-slip additions for everyone (tunjangan). */
  allowances: { label: string; amount: number }[]
  /** Percent-of-base-salary deductions (e.g. BPJS, PPh 21 estimate). */
  percent_deductions: { label: string; percent: number }[]
}

export const EMPTY_PAYROLL_RULES: PayrollRules = {
  late_penalty_per_minute: 0,
  overtime_per_hour: 0,
  absence_deduction_per_day: 0,
  allowances: [],
  percent_deductions: [],
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

export function parsePayrollRules(settings: unknown): PayrollRules {
  const raw = ((settings ?? {}) as { payroll?: Partial<PayrollRules> }).payroll ?? {}
  return {
    late_penalty_per_minute: num(raw.late_penalty_per_minute),
    overtime_per_hour: num(raw.overtime_per_hour),
    absence_deduction_per_day: num(raw.absence_deduction_per_day),
    allowances: (Array.isArray(raw.allowances) ? raw.allowances : []).filter((a) => a && typeof a.label === 'string' && num(a.amount) > 0).map((a) => ({ label: a.label, amount: num(a.amount) })),
    percent_deductions: (Array.isArray(raw.percent_deductions) ? raw.percent_deductions : [])
      .filter((d) => d && typeof d.label === 'string' && num(d.percent) > 0)
      .map((d) => ({ label: d.label, percent: Math.min(100, num(d.percent)) })),
  }
}

export function parseLeaveDaysPerYear(settings: unknown): number {
  const v = ((settings ?? {}) as { leave?: { days_per_year?: unknown } }).leave?.days_per_year
  return typeof v === 'number' && v >= 0 ? v : 12
}
