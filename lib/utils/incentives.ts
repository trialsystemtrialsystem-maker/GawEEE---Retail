// Pure daily-incentive calculation (todo.md Phase 33). Rules are deliberately
// simple typed thresholds, not a scripting engine: one rule pays a fixed
// amount when its condition holds for that staff member on that day.

export interface IncentiveRuleLike {
  id: string
  name: string
  metric: 'sales_target' | 'transactions' | 'attendance_bonus'
  threshold: number
  amount: number
}

export interface DayStats {
  revenue: number
  transactions: number
  attended: boolean
  late_minutes: number
}

export interface IncentiveResult {
  rule_id: string
  rule_name: string
  amount: number
  basis: { metric: string; threshold: number; achieved: number }
}

export function computeIncentives(rules: IncentiveRuleLike[], stats: DayStats): IncentiveResult[] {
  const out: IncentiveResult[] = []
  for (const rule of rules) {
    let achieved: number
    let earned: boolean
    switch (rule.metric) {
      case 'sales_target':
        achieved = stats.revenue
        earned = stats.revenue > 0 && stats.revenue >= rule.threshold
        break
      case 'transactions':
        achieved = stats.transactions
        earned = stats.transactions > 0 && stats.transactions >= rule.threshold
        break
      case 'attendance_bonus':
        // On-time attendance: showed up and wasn't late at all.
        achieved = stats.attended ? 1 : 0
        earned = stats.attended && stats.late_minutes === 0
        break
      default:
        continue
    }
    if (earned && rule.amount > 0) {
      out.push({ rule_id: rule.id, rule_name: rule.name, amount: rule.amount, basis: { metric: rule.metric, threshold: rule.threshold, achieved } })
    }
  }
  return out
}

/** ISO bounds of one WIB (UTC+7) business day, since invoices.created_at is
 * stored in UTC but a shop's "today" is the local calendar day. */
export function wibDayBounds(date: string): { startIso: string; endIso: string } {
  return {
    startIso: new Date(`${date}T00:00:00+07:00`).toISOString(),
    endIso: new Date(`${date}T23:59:59.999+07:00`).toISOString(),
  }
}
