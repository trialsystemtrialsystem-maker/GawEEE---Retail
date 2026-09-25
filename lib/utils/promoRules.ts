// Eligibility + discount maths shared by the POS, the coupon redeem route and
// the server-side discount guard, so all three agree on what a promotion or
// coupon may grant.

export interface PromoTerms {
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_purchase?: number | null
  max_discount?: number | null
}

export type PromoOutcome = { ok: true; amount: number } | { ok: false; reason: string }

/** Discount a promo/coupon grants on `subtotal`: minimum purchase gate, then
 * the percentage/fixed amount, then the optional cap, never above the subtotal. */
export function promoDiscount(t: PromoTerms, subtotal: number): PromoOutcome {
  const min = t.min_purchase ?? 0
  if (subtotal < min) return { ok: false, reason: `Minimal belanja ${Math.round(min).toLocaleString('id-ID')}` }
  let amount = t.discount_type === 'percentage' ? (subtotal * t.discount_value) / 100 : t.discount_value
  if (t.max_discount != null && t.max_discount > 0) amount = Math.min(amount, t.max_discount)
  amount = Math.min(subtotal, Math.max(0, Math.round(amount)))
  return { ok: true, amount }
}

export type PromoStatus = 'active' | 'scheduled' | 'expired' | 'inactive' | 'exhausted'

interface StatusInput {
  is_active: boolean
  start?: string | null
  end?: string | null
  usage_limit?: number | null
  usage_count?: number
}

/** Dates are YYYY-MM-DD strings; `today` in the same form. */
export function promoStatus(p: StatusInput, today: string): PromoStatus {
  if (!p.is_active) return 'inactive'
  if (p.end && p.end < today) return 'expired'
  if (p.start && p.start > today) return 'scheduled'
  if (p.usage_limit != null && (p.usage_count ?? 0) >= p.usage_limit) return 'exhausted'
  return 'active'
}

export const PROMO_STATUS_LABEL: Record<PromoStatus, string> = {
  active: 'Aktif',
  scheduled: 'Terjadwal',
  expired: 'Berakhir',
  inactive: 'Nonaktif',
  exhausted: 'Habis dipakai',
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
export function generateCouponCode(prefix = '', length = 6, rand: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < length; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]
  return `${prefix.toUpperCase().replace(/[^A-Z0-9]/g, '')}${s}`
}
