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

  const { data, error } = await auth.supabase
    .rpc('void_invoice', { p_invoice_id: id, p_voided_by: auth.authUserId, p_reason: reason })
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
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
