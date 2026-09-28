import type { AuthContext } from '@/lib/utils/auth-context'
import { checkDiscounts, DEFAULT_MAX_CASHIER_DISCOUNT_PERCENT, type Claim } from '@/lib/utils/discountRules'
import { promoDiscount } from '@/lib/utils/promoRules'
import { checkRateLimit } from '@/lib/utils/rateLimit'

const MANAGER_ROLES = ['outlet_manager', 'master_admin']

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
  /** A manager's PIN (staff_members.pin_code), typed by the cashier at
   * checkout to raise their own discount cap for this one sale — re-verified
   * here (never trusted from a prior /api/manager-approval call) so nothing
   * client-supplied ever grants the override on its own. */
  manager_override_pin?: string
  client_ip?: string
}

export interface DiscountGuardResult {
  error: string | null
  /** Set when a manager PIN raised the cap — the invoice route stamps this
   * onto invoices.discount_approved_by. */
  approved_by?: string
}

/** Verifies a manager/master_admin PIN for this outlet (018_employee_
 * expansion.sql's staff_members.pin_code, added for "quick cashier
 * switching", reused here) — shared by /api/manager-approval (the POS's
 * "ask now" check) and the guard's inline re-verification at checkout. */
export async function verifyManagerPin(auth: AuthContext, outletId: string, pin: string): Promise<{ id: string; name: string } | null> {
  const sb = auth.supabase
  const { data: staff } = await sb.from('staff_members').select('id, email, user_id').eq('outlet_id', outletId).eq('pin_code', pin).is('deleted_at', null)
  for (const s of staff ?? []) {
    const { data: user } = s.user_id
      ? await sb.from('users').select('id, full_name, role').eq('id', s.user_id).maybeSingle()
      : s.email
        ? await sb.from('users').select('id, full_name, role').eq('email', s.email).eq('company_id', auth.company_id).maybeSingle()
        : { data: null }
    if (user && MANAGER_ROLES.includes(user.role)) return { id: user.id, name: user.full_name }
  }
  return null
}

/** Checks the discounts on a checkout can be justified; runs before
 * create_invoice(), so a forged or inflated discount never reaches the
 * database. */
export async function guardInvoiceDiscounts(auth: AuthContext, input: InvoiceDiscountInput): Promise<DiscountGuardResult> {
  const lineDiscounts = input.items.reduce((s, i) => s + (i.discount ?? 0), 0)
  if (input.discount_amount <= 0 && lineDiscounts <= 0) return { error: null }

  const sb = auth.supabase
  const { data: products } = await sb.from('products').select('id, selling_price').in('id', input.items.map((i) => i.product_id))
  const price = new Map((products ?? []).map((p) => [p.id, p.selling_price]))
  if (input.items.some((i) => !price.has(i.product_id))) return { error: null } // unknown product: create_invoice reports it properly
  const gross = input.items.reduce((s, i) => s + (price.get(i.product_id) as number) * i.quantity, 0)

  const claims: Claim[] = []
  const today = new Date().toISOString().slice(0, 10)

  if (input.promotion_id && input.promotion_discount_amount) {
    const { data: promo } = await sb.from('promotions').select('*').eq('id', input.promotion_id).maybeSingle()
    if (!promo || promo.outlet_id !== input.outlet_id || !promo.is_active || promo.start_date > today || promo.end_date < today) return { error: 'Promo yang dipakai tidak berlaku' }
    if (promo.usage_limit != null) {
      const { count } = await sb.from('promotion_applications').select('id', { count: 'exact', head: true }).eq('promotion_id', promo.id)
      if ((count ?? 0) >= promo.usage_limit) return { error: 'Promo sudah mencapai batas pemakaian' }
    }
    const granted = promoDiscount(promo, gross)
    if (!granted.ok) return { error: `Promo tidak berlaku: ${granted.reason}` }
    claims.push({ claimed: input.promotion_discount_amount, max: granted.amount, label: 'promo' })
  }

  if (input.coupon_code && input.coupon_discount_amount) {
    const { data: coupon } = await sb.from('coupons').select('*').eq('outlet_id', input.outlet_id).ilike('code', input.coupon_code).maybeSingle()
    if (!coupon || !coupon.is_active || (coupon.starts_at && coupon.starts_at > today) || (coupon.expires_at && coupon.expires_at < today)) return { error: 'Kupon yang dipakai tidak berlaku' }
    if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) return { error: 'Kupon sudah mencapai batas penggunaan' }
    const granted = promoDiscount(coupon, gross)
    if (!granted.ok) return { error: `Kupon tidak berlaku: ${granted.reason}` }
    claims.push({ claimed: input.coupon_discount_amount, max: granted.amount, label: 'kupon' })
  }

  if (input.redeem_points && input.redeem_points > 0) {
    if (!input.loyalty_customer_id) return { error: 'Penukaran poin butuh pelanggan terdaftar' }
    const [{ data: outlet }, { data: ledger }] = await Promise.all([
      sb.from('outlets').select('loyalty_rp_per_point').eq('id', input.outlet_id).single(),
      sb.from('loyalty_ledger').select('points_change').eq('customer_id', input.loyalty_customer_id),
    ])
    const balance = (ledger ?? []).reduce((s, r) => s + r.points_change, 0)
    // Previously an insufficient balance was skipped silently AFTER the discount had been granted.
    if (balance < input.redeem_points) return { error: 'Saldo poin pelanggan tidak cukup untuk penukaran ini' }
    claims.push({ claimed: input.redeem_discount_amount ?? 0, max: input.redeem_points * (outlet?.loyalty_rp_per_point ?? 0), label: 'poin' })
  }

  const { data: company } = await sb.from('companies').select('settings').eq('id', auth.company_id).single()
  const configured = ((company?.settings ?? {}) as { max_cashier_discount_percent?: unknown }).max_cashier_discount_percent
  const maxPercent = typeof configured === 'number' && configured >= 0 && configured <= 100 ? configured : DEFAULT_MAX_CASHIER_DISCOUNT_PERCENT

  const result = checkDiscounts({ gross_subtotal: gross, line_discounts: lineDiscounts, discount_amount: input.discount_amount, claims, role: auth.role, max_unexplained_percent: maxPercent })
  if (result.ok) return { error: null }

  // The cap was exceeded — a manager's PIN can raise it for this one sale.
  // Re-verified here regardless of any prior /api/manager-approval call, and
  // rate-limited the same way, so nothing client-supplied grants this alone.
  if (input.manager_override_pin) {
    const limit = await checkRateLimit(`manager-approval:${input.outlet_id}:${input.client_ip ?? 'unknown'}`, 5, 300)
    if (!limit.allowed) return { error: `Terlalu banyak percobaan PIN manager. Coba lagi dalam ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} menit.` }
    const manager = await verifyManagerPin(auth, input.outlet_id, input.manager_override_pin)
    if (!manager) return { error: 'PIN manager tidak valid' }
    // A manager's own cap is the subtotal only — re-check under that role.
    const managerResult = checkDiscounts({ gross_subtotal: gross, line_discounts: lineDiscounts, discount_amount: input.discount_amount, claims, role: 'outlet_manager', max_unexplained_percent: maxPercent })
    if (!managerResult.ok) return { error: managerResult.error }
    return { error: null, approved_by: manager.id }
  }

  return { error: result.error }
}
