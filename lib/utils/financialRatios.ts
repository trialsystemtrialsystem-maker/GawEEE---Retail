// Pure financial ratios from the Neraca and Laba Rugi report totals, so the UI
// and tests compute them identically. A ratio whose denominator is zero is
// null (shown as "-"), never NaN/Infinity.

export interface RatioInput {
  currentAssets: number
  inventory: number
  totalLiability: number
  totalEquity: number
  totalAsset: number
  revenue: number
  cogs: number
  operatingExpense: number
  netProfit: number
}

export interface Ratio {
  key: string
  label: string
  value: number | null
  format: 'x' | 'pct'
  hint: string
}

const div = (a: number, b: number) => (Math.abs(b) < 0.005 ? null : a / b)

export function computeRatios(i: RatioInput): Ratio[] {
  const grossProfit = i.revenue - i.cogs
  return [
    { key: 'current', label: 'Rasio Lancar', value: div(i.currentAssets, i.totalLiability), format: 'x', hint: 'Aset lancar ÷ kewajiban. Di atas 1× berarti kewajiban tertutup aset lancar.' },
    { key: 'quick', label: 'Rasio Cepat', value: div(i.currentAssets - i.inventory, i.totalLiability), format: 'x', hint: 'Aset lancar tanpa persediaan ÷ kewajiban.' },
    { key: 'dte', label: 'Utang terhadap Ekuitas', value: div(i.totalLiability, i.totalEquity), format: 'x', hint: 'Seberapa besar bisnis dibiayai utang dibanding modal sendiri.' },
    { key: 'gross', label: 'Margin Kotor', value: div(grossProfit, i.revenue), format: 'pct', hint: '(Pendapatan − HPP) ÷ pendapatan.' },
    { key: 'opex', label: 'Rasio Beban Operasional', value: div(i.operatingExpense, i.revenue), format: 'pct', hint: 'Beban operasional ÷ pendapatan.' },
    { key: 'net', label: 'Margin Bersih', value: div(i.netProfit, i.revenue), format: 'pct', hint: 'Laba bersih ÷ pendapatan.' },
    { key: 'roa', label: 'Imbal Hasil Aset (ROA)', value: div(i.netProfit, i.totalAsset), format: 'pct', hint: 'Laba bersih periode ÷ total aset.' },
  ]
}

export function formatRatio(r: Ratio): string {
  if (r.value === null) return '-'
  return r.format === 'pct' ? `${(r.value * 100).toFixed(1)}%` : `${r.value.toFixed(2)}×`
}
