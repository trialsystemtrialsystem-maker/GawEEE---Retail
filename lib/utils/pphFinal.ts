// PPh Final UMKM (PP 55/2022): a flat rate (0.5%) on monthly gross turnover
// (omzet bruto, excluding PPN). Individual taxpayers (WP orang pribadi) are
// exempt on the first Rp 500 juta of turnover per tax year; entities (CV/PT)
// have no such allowance (threshold 0). Pure so the report and tests agree.

export interface PphSettings {
  enabled: boolean
  /** Percent, e.g. 0.5 */
  rate_percent: number
  /** Annual turnover exempt from the tax (Rp); 500_000_000 for individuals, 0 for entities. */
  threshold: number
}

export const DEFAULT_PPH: PphSettings = { enabled: true, rate_percent: 0.5, threshold: 500_000_000 }

export function parsePphSettings(settings: unknown): PphSettings {
  const raw = ((settings ?? {}) as { tax?: Partial<PphSettings> }).tax ?? {}
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback)
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_PPH.enabled,
    rate_percent: Math.min(100, num(raw.rate_percent, DEFAULT_PPH.rate_percent)),
    threshold: num(raw.threshold, DEFAULT_PPH.threshold),
  }
}

export interface PphMonth {
  month: string // YYYY-MM
  gross_turnover: number
  cumulative_turnover: number
  /** Part of this month's turnover that is taxed (after the annual exemption). */
  taxable_turnover: number
  tax_due: number
}

/** `months`: gross turnover per month of ONE tax year, any order. The exemption
 * is consumed chronologically, so the tax for a month depends on the months
 * before it. Missing months are simply absent. */
export function computePphFinal(months: { month: string; gross: number }[], s: PphSettings): PphMonth[] {
  let cumulative = 0
  return [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const before = cumulative
      cumulative += m.gross
      // Portion of this month that lies above the threshold.
      const taxable = s.enabled ? Math.max(0, cumulative - Math.max(before, s.threshold)) : 0
      return {
        month: m.month,
        gross_turnover: m.gross,
        cumulative_turnover: cumulative,
        taxable_turnover: taxable,
        tax_due: Math.round((taxable * s.rate_percent) / 100),
      }
    })
}
