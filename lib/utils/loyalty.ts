import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

/** Pure points calculation, split out from earnLoyaltyPoints() below purely
 * so it's unit-testable without a Supabase client — same reasoning as
 * evaluateRateLimit() in lib/utils/rateLimit.ts. Whole-thousands-of-rupiah
 * earn only: a Rp 999 sale earns 0 points at any rate, matching the
 * Math.floor(total / 1000) the SQL side of this feature was designed around. */
export function calculateLoyaltyPoints(total: number, pointsPer1000: number): number {
  return Math.floor(total / 1000) * pointsPer1000
}

/** Auto-earns loyalty points for a just-settled sale — called once an
 * invoice is confirmed paid (immediately for cash in POST /api/invoices,
 * or from the settlement routes for e-wallet/bank once the payment clears).
 * Best-effort and silent on any failure: a customer not being registered,
 * an outlet with loyalty_points_per_1000 = 0 (not configured), or any
 * database error all just mean no points get recorded — never something
 * that should be able to affect the sale itself. See
 * 063_loyalty_and_promotion_completion.sql. */
export async function earnLoyaltyPoints(supabase: SupabaseClient<Database>, invoiceId: string) {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('outlet_id, customer_phone, total, cashier_id')
      .eq('id', invoiceId)
      .single()
    if (!invoice?.customer_phone) return

    const { data: outlet } = await supabase.from('outlets').select('loyalty_points_per_1000').eq('id', invoice.outlet_id).single()
    if (!outlet || outlet.loyalty_points_per_1000 <= 0) return

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('outlet_id', invoice.outlet_id)
      .eq('phone', invoice.customer_phone)
      .maybeSingle()
    if (!customer) return

    const points = calculateLoyaltyPoints(invoice.total, outlet.loyalty_points_per_1000)
    if (points <= 0) return

    // customer_id + invoice_id together keep this idempotent if a settlement
    // webhook somehow fires twice for the same invoice. Scoped to a positive
    // points_change specifically — a point *redemption* against this same
    // invoice (negative points_change, see POST /api/invoices) shares the
    // same invoice_id + customer_id and must not be mistaken for "points
    // already earned here."
    const { data: existing } = await supabase.from('loyalty_ledger').select('id').eq('invoice_id', invoiceId).eq('customer_id', customer.id).gt('points_change', 0).maybeSingle()
    if (existing) return

    await supabase.from('loyalty_ledger').insert({
      customer_id: customer.id,
      points_change: points,
      reason: `Poin otomatis dari transaksi`,
      recorded_by: invoice.cashier_id,
      invoice_id: invoiceId,
    })
  } catch {
    // Never let a bookkeeping-adjacent side effect affect the caller.
  }
}
