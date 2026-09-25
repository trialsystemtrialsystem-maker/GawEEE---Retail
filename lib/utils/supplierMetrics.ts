// Supplier scorecard math (Supplier 360). Pure so the profile route and the
// tests agree on what "on time" and "lead time" mean.

export interface PoDates {
  order_date: string // YYYY-MM-DD
  requested_delivery_date: string | null
  actual_delivery_date: string | null
}

const dayMs = 86_400_000
const dayNumber = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / dayMs)

export interface DeliveryStats {
  delivered: number
  /** Average days from order to delivery; null with no delivered PO. */
  avg_lead_days: number | null
  /** Share (0-1) delivered on/before the requested date; null when none had a requested date. */
  on_time_rate: number | null
  late_count: number
}

export function deliveryStats(pos: PoDates[]): DeliveryStats {
  const delivered = pos.filter((p) => p.actual_delivery_date)
  const leads = delivered.map((p) => Math.max(0, dayNumber(p.actual_delivery_date as string) - dayNumber(p.order_date)))
  const timed = delivered.filter((p) => p.requested_delivery_date)
  const onTime = timed.filter((p) => (p.actual_delivery_date as string) <= (p.requested_delivery_date as string))
  return {
    delivered: delivered.length,
    avg_lead_days: leads.length ? Math.round((leads.reduce((s, n) => s + n, 0) / leads.length) * 10) / 10 : null,
    on_time_rate: timed.length ? onTime.length / timed.length : null,
    late_count: timed.length - onTime.length,
  }
}

export interface PricePoint {
  product_id: string
  date: string
  unit_cost: number
}

export interface PriceTrend {
  product_id: string
  first: number
  last: number
  min: number
  max: number
  /** (last - first) / first; null when first is 0. */
  change_pct: number | null
  purchases: number
}

/** Per product: first/last/min/max unit cost paid to this supplier and how much
 * the price moved since the first purchase. */
export function priceTrends(points: PricePoint[]): PriceTrend[] {
  const byProduct = new Map<string, PricePoint[]>()
  for (const p of points) byProduct.set(p.product_id, [...(byProduct.get(p.product_id) ?? []), p])
  return Array.from(byProduct.entries()).map(([product_id, list]) => {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const costs = sorted.map((p) => p.unit_cost)
    const first = costs[0]
    const last = costs[costs.length - 1]
    return { product_id, first, last, min: Math.min(...costs), max: Math.max(...costs), change_pct: first > 0 ? (last - first) / first : null, purchases: sorted.length }
  })
}
