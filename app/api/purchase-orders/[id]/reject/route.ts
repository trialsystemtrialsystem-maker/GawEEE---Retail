import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/purchase-orders/:id/reject — manager+ only. Mirrors approve/route.ts.
export async function POST(_request: Request, ctx: RouteContext<'/api/purchase-orders/[id]/reject'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params

  const { error } = await auth.supabase
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending_approval')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ status: 'rejected' })
}
