// Server-side discount integrity for POST /api/invoices. The POS computes every
// discount in the browser and sends the total, so the API must not take it on
// faith: each claimed component (promotion, coupon, loyalty redemption) is
// checked against what that component could actually grant, and whatever is
// left unexplained (bundle price cuts, or a hand-crafted request) is capped for
// cashier/staff accounts. Pure, so every rule is unit-tested.

export const DEFAULT_MAX_CASHIER_DISCOUNT_PERCENT = 30

/** What a percentage/fixed promotion or coupon may grant on `subtotal`. */
export function grantedDiscount(subtotal: number, type: 'percentage' | 'fixed', value: number): number {
  const raw = type === 'percentage' ? (subtotal * value) / 100 : value
  return Math.min(subtotal, Math.max(0, Math.round(raw)))
}

export interface Claim {
  /** What the client says this component discounted. */
  claimed: number
  /** The most that component could legitimately grant. */
  max: number
  label: string
}

export interface DiscountInput {
  /** Sum of selling_price x quantity before any discount, computed server-side. */
  gross_subtotal: number
  /** Sum of per-line discounts sent with the items. */
  line_discounts: number
  /** The order-level discount_amount the client sent (includes the components). */
  discount_amount: number
  claims: Claim[]
  role: string
  max_unexplained_percent: number
}

export type DiscountCheck = { ok: true; unexplained: number } | { ok: false; error: string }

const TOLERANCE = 1 // rupiah of rounding slack

export function checkDiscounts(i: DiscountInput): DiscountCheck {
  if (i.discount_amount < 0 || i.line_discounts < 0) return { ok: false, error: 'Diskon tidak valid' }

  for (const c of i.claims) {
    if (c.claimed > c.max + TOLERANCE) return { ok: false, error: `Diskon ${c.label} melebihi yang boleh diberikan (${Math.round(c.max)})` }
  }

  if (i.line_discounts + i.discount_amount > i.gross_subtotal + TOLERANCE) {
    return { ok: false, error: 'Total diskon melebihi subtotal transaksi' }
  }

  const explained = i.claims.reduce((s, c) => s + c.claimed, 0)
  const unexplained = Math.max(0, i.discount_amount - explained)
  const isManager = ['outlet_manager', 'master_admin'].includes(i.role)
  if (!isManager && unexplained > (i.gross_subtotal * i.max_unexplained_percent) / 100 + TOLERANCE) {
    return { ok: false, error: `Diskon di luar promo/kupon/poin dibatasi ${i.max_unexplained_percent}% untuk kasir — minta persetujuan manager` }
  }
  return { ok: true, unexplained }
}
