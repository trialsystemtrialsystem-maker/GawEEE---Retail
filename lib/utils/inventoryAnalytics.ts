// Pure inventory math shared by the stock list, kartu stok, valuation and
// reorder screens, so every screen answers "how much is enough?" the same way.

/** How many days current stock lasts at the recent selling pace; null when
 * nothing has been selling (cover is unbounded, not zero). */
export function daysOfCover(onHand: number, avgDailySales: number): number | null {
  if (avgDailySales <= 0) return null
  return Math.round((onHand / avgDailySales) * 10) / 10
}

export interface ReorderInput {
  onHand: number
  reorderLevel: number
  /** Product's configured order quantity (0 = none set). */
  reorderQuantity: number
  avgDailySales: number
  /** Days the supplier takes to deliver. */
  leadTimeDays?: number
  /** Days of stock to hold after the delivery arrives. */
  coverDays?: number
}

/** Units to order now. Zero when stock is comfortably above the reorder level
 * and the sales pace does not run it out within the lead time. Otherwise the
 * larger of the configured order quantity and what covers lead time + cover
 * days at the current pace, minus what is on hand. */
export function suggestedReorderQty(i: ReorderInput): number {
  const lead = i.leadTimeDays ?? 7
  const cover = i.coverDays ?? 14
  const needsOrder = i.onHand <= i.reorderLevel || (i.avgDailySales > 0 && i.onHand < i.avgDailySales * lead)
  if (!needsOrder) return 0
  const target = Math.ceil(i.avgDailySales * (lead + cover)) + i.reorderLevel
  const byPace = Math.max(0, target - i.onHand)
  return Math.max(byPace, i.reorderQuantity > 0 ? i.reorderQuantity : 0, i.onHand <= 0 ? 1 : 0)
}

export type AbcClass = 'A' | 'B' | 'C'

/** ABC analysis by stock value: A = the items making up the first 80% of total
 * value, B = the next 15%, C = the rest. Zero-value items are always C. */
export function abcClassify<T extends { id: string; value: number }>(items: T[]): Map<string, AbcClass> {
  const result = new Map<string, AbcClass>()
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0)
  let running = 0
  for (const item of [...items].sort((a, b) => b.value - a.value)) {
    if (total <= 0 || item.value <= 0) {
      result.set(item.id, 'C')
      continue
    }
    const before = running / total
    running += item.value
    result.set(item.id, before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C')
  }
  return result
}

export type StockHealth = 'dead' | 'slow' | 'active' | 'empty'

/** Dead = stock but no sales in the window; slow = will take over `slowDays`
 * to sell through at the current pace. */
export function stockHealth(onHand: number, soldInWindow: number, windowDays: number, slowDays = 90): StockHealth {
  if (onHand <= 0) return 'empty'
  if (soldInWindow <= 0) return 'dead'
  const cover = daysOfCover(onHand, soldInWindow / windowDays)
  return cover !== null && cover > slowDays ? 'slow' : 'active'
}

export interface LedgerRow {
  quantity_change: number
}

/** Running balance per ledger row. `rowsNewestFirst` must be the complete tail
 * of the ledger up to now; the balance after the newest row is `currentOnHand`,
 * and each older row's balance is derived by undoing the newer movements, so it
 * stays correct even when the ledger predates the stock counter. */
export function runningBalances<T extends LedgerRow>(rowsNewestFirst: T[], currentOnHand: number): (T & { balance: number })[] {
  let balance = currentOnHand
  return rowsNewestFirst.map((row) => {
    const out = { ...row, balance }
    balance -= row.quantity_change
    return out
  })
}
