import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/invoices/:id/void — manager+ only, within 24h. See prd.md §4.3.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/invoices/[id]/void'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Pembatalan memerlukan persetujuan manager' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason : ''
  if (!reason.trim()) {
    return NextResponse.json({ error: 'Alasan pembatalan wajib diisi' }, { status: 400 })
  }

  const { data: invoiceBeforeVoid } = await auth.supabase.from('invoices').select('invoice_number').eq('id', id).maybeSingle()

  const { data, error } = await auth.supabase
    .rpc('void_invoice', { p_invoice_id: id, p_voided_by: auth.authUserId, p_reason: reason })
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  // void_invoice() only reverses stock and payment status — it never
  // touches any of the additive sales-identification side effects built up
  // this session (coupon/promotion/loyalty), all deliberately non-atomic
  // follow-ups on create_invoice() rather than changes to it (same reason
  // void_invoice() itself stays untouched here). A voided sale needs the
  // mirror image of those follow-ups, or a customer keeps points they
  // earned/spent on a transaction that no longer exists, and a coupon's
  // usage_limit gets burned by a sale that was cancelled. Best-effort and
  // non-blocking: the void itself already succeeded above, so a failure
  // here must never surface as an error to the caller.
  try {
    const { data: loyaltyRows } = await auth.supabase.from('loyalty_ledger').select('id, customer_id, points_change').eq('invoice_id', id)
    for (const row of loyaltyRows ?? []) {
      await auth.supabase.from('loyalty_ledger').insert({
        customer_id: row.customer_id,
        points_change: -row.points_change,
        reason: `Pembatalan transaksi ${invoiceBeforeVoid?.invoice_number ?? id}`,
        recorded_by: auth.authUserId,
        invoice_id: id,
      })
    }

    const { data: couponRows } = await auth.supabase.from('coupon_redemptions').select('coupon_id').eq('invoice_id', id)
    for (const row of couponRows ?? []) {
      const { data: coupon } = await auth.supabase.from('coupons').select('usage_count').eq('id', row.coupon_id).maybeSingle()
      if (coupon) {
        await auth.supabase.from('coupons').update({ usage_count: Math.max(0, coupon.usage_count - 1) }).eq('id', row.coupon_id)
      }
    }
  } catch {
    // Never let this best-effort cleanup turn an already-successful void into a failed request.
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    outlet_id: auth.outlet_id,
    action_type: 'VOID',
    entity_type: 'invoice',
    entity_id: id,
    reason_for_action: reason,
    status: 'success',
  })

  return NextResponse.json({
    status: 'voided',
    voided_at: data!.voided_at,
    stock_returned: data!.stock_returned,
    payment_refund_initiated: true,
  })
}
