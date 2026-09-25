import type { AuthContext } from '@/lib/utils/auth-context'
import { checkDiscounts, DEFAULT_MAX_CASHIER_DISCOUNT_PERCENT, type Claim } from '@/lib/utils/discountRules'
import { promoDiscount } from '@/lib/utils/promoRules'

export interface InvoiceDiscountInput {
  outlet_id: string
  items: { product_id: string; quantity: number; discount?: number }[]
  discount_amount: number
  coupon_code?: string
  coupon_discount_amount?: number
  promotion_id?: string
  promotion_discount_amount?: number
  loyalty_customer_id?: string
  redeem_points?: number
  redeem_discount_amount?: number
}

/** Returns an error message when the discounts on a checkout cannot be
 * justified, otherwise null. Runs before create_invoice(), so a forged or
 * inflated discount never reaches the database. */
export async function guardInvoiceDiscounts(auth: AuthContext, input: InvoiceDiscountInput): Promise<string | null> {
  const lineDiscounts = input.items.reduce((s, i) => s + (i.discount ?? 0), 0)
  if (input.discount_amount <= 0 && lineDiscounts <= 0) return null

  const sb = auth.supabase
  const { data: products } = await sb.from('products').select('id, selling_price').in('id', input.items.map((i) => i.product_id))
  const price = new Map((products ?? []).map((p) => [p.id, p.selling_price]))
  if (input.items.some((i) => !price.has(i.product_id))) return null // unknown product: create_invoice reports it properly
  const gross = input.items.reduce((s, i) => s + (price.get(i.product_id) as number) * i.quantity, 0)

  const claims: Claim[] = []
  const today = new Date().toISOString().slice(0, 10)

  if (input.promotion_id && input.promotion_discount_amount) {
    const { data: promo } = await sb.from('promotions').select('*').eq('id', input.promotion_id).maybeSingle()
    if (!promo || promo.outlet_id !== input.outlet_id || !promo.is_active || promo.start_date > today || promo.end_date < today) return 'Promo yang dipakai tidak berlaku'
    if (promo.usage_limit != null) {
      const { count } = await sb.from('promotion_applications').select('id', { count: 'exact', head: true }).eq('promotion_id', promo.id)
      if ((count ?? 0) >= promo.usage_limit) return 'Promo sudah mencapai batas pemakaian'
    }
    const granted = promoDiscount(promo, gross)
    if (!granted.ok) return `Promo tidak berlaku: ${granted.reason}`
    claims.push({ claimed: input.promotion_discount_amount, max: granted.amount, label: 'promo' })
  }

  if (input.coupon_code && input.coupon_discount_amount) {
    const { data: coupon } = await sb.from('coupons').select('*').eq('outlet_id', input.outlet_id).ilike('code', input.coupon_code).maybeSingle()
    if (!coupon || !coupon.is_active || (coupon.starts_at && coupon.starts_at > today) || (coupon.expires_at && coupon.expires_at < today)) return 'Kupon yang dipakai tidak berlaku'
    if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) return 'Kupon sudah mencapai batas penggunaan'
    const granted = promoDiscount(coupon, gross)
    if (!granted.ok) return `Kupon tidak berlaku: ${granted.reason}`
    claims.push({ claimed: input.coupon_discount_amount, max: granted.amount, label: 'kupon' })
  }

  if (input.redeem_points && input.redeem_points > 0) {
    if (!input.loyalty_customer_id) return 'Penukaran poin butuh pelanggan terdaftar'
    const [{ data: outlet }, { data: ledger }] = await Promise.all([
      sb.from('outlets').select('loyalty_rp_per_point').eq('id', input.outlet_id).single(),
      sb.from('loyalty_ledger').select('points_change').eq('customer_id', input.loyalty_customer_id),
    ])
    const balance = (ledger ?? []).reduce((s, r) => s + r.points_change, 0)
    // Previously an insufficient balance was skipped silently AFTER the discount had been granted.
    if (balance < input.redeem_points) return 'Saldo poin pelanggan tidak cukup untuk penukaran ini'
    claims.push({ claimed: input.redeem_discount_amount ?? 0, max: input.redeem_points * (outlet?.loyalty_rp_per_point ?? 0), label: 'poin' })
  }

  const { data: company } = await sb.from('companies').select('settings').eq('id', auth.company_id).single()
  const configured = ((company?.settings ?? {}) as { max_cashier_discount_percent?: unknown }).max_cashier_discount_percent
  const maxPercent = typeof configured === 'number' && configured >= 0 && configured <= 100 ? configured : DEFAULT_MAX_CASHIER_DISCOUNT_PERCENT

  const result = checkDiscounts({ gross_subtotal: gross, line_discounts: lineDiscounts, discount_amount: input.discount_amount, claims, role: auth.role, max_unexplained_percent: maxPercent })
  return result.ok ? null : result.error
}
