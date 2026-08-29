import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/purchase-orders/:id/approve — manager+ only. See prd.md §4.5.
export async function POST(_request: Request, ctx: RouteContext<'/api/purchase-orders/[id]/approve'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const approvedAt = new Date().toISOString()

  const { error } = await auth.supabase
    .from('purchase_orders')
    .update({ status: 'ordered', approved_by: auth.authUserId })
    .eq('id', id)
    .eq('status', 'pending_approval')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ status: 'approved', approved_at: approvedAt })
}
