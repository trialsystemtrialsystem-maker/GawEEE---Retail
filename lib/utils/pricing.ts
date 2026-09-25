// Price arithmetic for bulk price changes and margin display. Pure so the bulk
// preview, the apply step and the tests agree to the rupiah.

export type RoundTo = 0 | 100 | 500 | 1000

/** Rounds to the nearest `step` (0 = whole rupiah). */
export function roundPrice(value: number, step: RoundTo = 0): number {
  if (step === 0) return Math.round(value)
  return Math.round(value / step) * step
}

/** Gross margin as a share of the selling price (0.3 = 30%); null when there is no selling price. */
export function marginOf(purchase: number, selling: number): number | null {
  return selling > 0 ? (selling - purchase) / selling : null
}

export type BulkMode =
  | { mode: 'percent'; value: number } // +10 raises the field by 10%, -5 lowers by 5%
  | { mode: 'amount'; value: number } // +1000 adds Rp 1.000
  | { mode: 'margin'; value: number } // set selling price for this gross margin (0-95%) off purchase price
  | { mode: 'set'; value: number } // set to an exact price

export interface BulkResult {
  purchase_price: number
  selling_price: number
}

/** New prices after a bulk rule. `field` is which price the rule edits; margin
 * mode always edits the selling price. Never returns a negative price. */
export function applyBulkChange(current: BulkResult, rule: BulkMode, field: 'selling_price' | 'purchase_price', round: RoundTo = 0): BulkResult {
  const out = { ...current }
  const target = rule.mode === 'margin' ? 'selling_price' : field
  const base = current[target]
  let next: number
  switch (rule.mode) {
    case 'percent':
      next = base * (1 + rule.value / 100)
      break
    case 'amount':
      next = base + rule.value
      break
    case 'set':
      next = rule.value
      break
    case 'margin': {
      const m = Math.min(0.95, Math.max(0, rule.value / 100))
      next = current.purchase_price / (1 - m)
      break
    }
  }
  out[target] = Math.max(0, roundPrice(next, round))
  return out
}
