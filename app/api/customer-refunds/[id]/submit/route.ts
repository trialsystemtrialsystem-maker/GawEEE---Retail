import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/customer-refunds/:id/submit — manager+ only. Atomically restocks
// the refund's line items via submit_customer_refund(). Does not touch the
// original invoice or its payment_transactions.
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/customer-refunds/[id]/submit'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase.rpc('submit_customer_refund', {
    p_refund_id: id,
    p_submitted_by: auth.id,
  })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ total_amount: data?.[0]?.total_amount ?? 0 })
}
