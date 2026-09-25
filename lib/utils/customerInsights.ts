// Customer 360 math. Invoices carry only customer_name/customer_phone (no FK to
// customers), so a customer's history is matched on a normalized phone number.

/** Digits only, with Indonesian variants unified to a leading "62":
 * 0812…, +62 812…, 62812… and 812… all become 62812…. Returns '' when the
 * input has too few digits to be a real number (so short/blank values never
 * match each other). */
export function normalizePhone(raw: string | null | undefined): string {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.startsWith('0')) d = `62${d.slice(1)}`
  else if (d.startsWith('8')) d = `62${d}`
  return d.length >= 9 ? d : ''
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizePhone(a)
  return x !== '' && x === normalizePhone(b)
}

export type CustomerSegment = 'vip' | 'loyal' | 'new' | 'at_risk' | 'lost' | 'inactive'

export interface SegmentInput {
  orders: number
  spend: number
  /** Days since the last purchase; null when they never bought. */
  daysSinceLast: number | null
  /** Spend threshold (Rp) for VIP; defaults to Rp 2.000.000 lifetime. */
  vipSpend?: number
}

export const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  vip: 'VIP',
  loyal: 'Setia',
  new: 'Baru',
  at_risk: 'Berisiko pergi',
  lost: 'Hilang',
  inactive: 'Belum pernah beli',
}

/** Simple, explainable recency/frequency/monetary bucket (not a model):
 * no purchase → inactive; >180 days → lost; >60 days → at risk; else VIP for
 * high spend, loyal for repeat buyers, new for a first/second purchase. */
export function customerSegment(i: SegmentInput): CustomerSegment {
  if (i.orders === 0 || i.daysSinceLast === null) return 'inactive'
  if (i.daysSinceLast > 180) return 'lost'
  if (i.daysSinceLast > 60) return 'at_risk'
  if (i.spend >= (i.vipSpend ?? 2_000_000)) return 'vip'
  if (i.orders >= 3) return 'loyal'
  return 'new'
}

/** Average days between consecutive purchases (needs ≥2); null otherwise. */
export function purchaseInterval(dates: string[]): number | null {
  const t = dates.map((d) => Date.parse(d)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (t.length < 2) return null
  const gaps = t.slice(1).map((x, i) => (x - t[i]) / 86_400_000)
  return Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10
}
