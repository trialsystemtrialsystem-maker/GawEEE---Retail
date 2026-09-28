// Pure aggregation for the Sales Summary report: totals, period buckets,
// previous-period comparison and ranked breakdowns. Kept free of I/O so every
// figure on the report is unit-tested.

export interface SaleLine {
  product_id: string
  name: string
  category: string
  quantity: number
  subtotal: number
  /** Total cost of the line (avg cost x qty); null when the sale predates costing. */
  cogs: number | null
}

export interface SaleInvoice {
  id: string
  created_at: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  payment_status: 'pending' | 'partial' | 'paid'
  order_status: 'draft' | 'completed' | 'voided'
  cashier_id: string
  customer_key: string | null
  customer_name: string | null
  lines: SaleLine[]
}

export interface SalesTotals {
  invoice_count: number
  items_sold: number
  gross: number
  discount: number
  net: number
  tax: number
  total: number
  avg_basket: number
  gross_profit: number
  margin_pct: number | null
  /** Share (0-100) of sold line value that had a recorded cost. */
  cost_coverage_pct: number
  unpaid_count: number
  void_count: number
  void_total: number
}

/** Voided and draft invoices never count as sales. */
export const isSale = (i: SaleInvoice) => i.order_status === 'completed'

export function summarize(invoices: SaleInvoice[]): SalesTotals {
  let gross = 0, discount = 0, tax = 0, total = 0, items = 0, unpaid = 0
  let count = 0, voidCount = 0, voidTotal = 0
  let costed = 0, revenueAll = 0, cogs = 0, revenueCosted = 0
  for (const inv of invoices) {
    if (inv.order_status === 'voided') {
      voidCount += 1
      voidTotal += inv.total
      continue
    }
    if (!isSale(inv)) continue
    count += 1
    gross += inv.subtotal
    discount += inv.discount_amount
    tax += inv.tax_amount
    total += inv.total
    if (inv.payment_status !== 'paid') unpaid += 1
    for (const l of inv.lines) {
      items += l.quantity
      revenueAll += l.subtotal
      if (l.cogs != null) {
        costed += 1
        cogs += l.cogs
        revenueCosted += l.subtotal
      }
    }
  }
  const net = gross - discount
  const grossProfit = revenueCosted - cogs
  return {
    invoice_count: count,
    items_sold: items,
    gross,
    discount,
    net,
    tax,
    total,
    avg_basket: count ? total / count : 0,
    gross_profit: grossProfit,
    margin_pct: costed && revenueCosted > 0 ? (grossProfit / revenueCosted) * 100 : null,
    cost_coverage_pct: revenueAll > 0 ? (revenueCosted / revenueAll) * 100 : 0,
    unpaid_count: unpaid,
    void_count: voidCount,
    void_total: voidTotal,
  }
}

export type Group = 'day' | 'week' | 'month'

/** Bucket label for an ISO timestamp: the day, the Monday of its week, or the month. UTC throughout. */
export function bucketKey(iso: string, group: Group): string {
  const day = iso.slice(0, 10)
  if (group === 'day') return day
  if (group === 'month') return day.slice(0, 7)
  const d = new Date(`${day}T00:00:00.000Z`)
  const offset = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

export interface TrendPoint {
  key: string
  total: number
  count: number
}

export function trend(invoices: SaleInvoice[], group: Group): TrendPoint[] {
  const map = new Map<string, TrendPoint>()
  for (const inv of invoices) {
    if (!isSale(inv)) continue
    const key = bucketKey(inv.created_at, group)
    const p = map.get(key) ?? { key, total: 0, count: 0 }
    p.total += inv.total
    p.count += 1
    map.set(key, p)
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/** Percent change vs the previous period; null when there is nothing to compare to. */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

/** The equally long range immediately before [start, end] (YYYY-MM-DD, inclusive). */
export function previousRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(`${start}T00:00:00.000Z`)
  const e = new Date(`${end}T00:00:00.000Z`)
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(s)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - days + 1)
  return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) }
}

export interface Ranked {
  key: string
  label: string
  quantity: number
  revenue: number
  profit: number | null
  count: number
}

/** Rank sale lines by revenue, grouped by whatever `keyOf` returns. */
export function rankLines(invoices: SaleInvoice[], keyOf: (l: SaleLine, inv: SaleInvoice) => { key: string; label: string }, limit = 10): Ranked[] {
  const map = new Map<string, Ranked & { seen: Set<string>; hasCost: boolean }>()
  for (const inv of invoices) {
    if (!isSale(inv)) continue
    for (const l of inv.lines) {
      const { key, label } = keyOf(l, inv)
      const r = map.get(key) ?? { key, label, quantity: 0, revenue: 0, profit: 0, count: 0, seen: new Set<string>(), hasCost: false }
      r.quantity += l.quantity
      r.revenue += l.subtotal
      if (l.cogs != null) {
        r.profit = (r.profit ?? 0) + (l.subtotal - l.cogs)
        r.hasCost = true
      }
      r.seen.add(inv.id)
      map.set(key, r)
    }
  }
  return [...map.values()]
    .map(({ seen, hasCost, ...r }) => ({ ...r, count: seen.size, profit: hasCost ? r.profit : null }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export interface CustomerRank {
  key: string
  name: string
  count: number
  total: number
}

export function topCustomers(invoices: SaleInvoice[], limit = 10): CustomerRank[] {
  const map = new Map<string, CustomerRank>()
  for (const inv of invoices) {
    if (!isSale(inv) || !inv.customer_key) continue
    const r = map.get(inv.customer_key) ?? { key: inv.customer_key, name: inv.customer_name ?? inv.customer_key, count: 0, total: 0 }
    r.count += 1
    r.total += inv.total
    map.set(inv.customer_key, r)
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit)
}
