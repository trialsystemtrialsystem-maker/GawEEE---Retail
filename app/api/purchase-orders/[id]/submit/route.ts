import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/purchase-orders/:id/submit — see prd.md §4.5
export async function POST(_request: Request, ctx: RouteContext<'/api/purchase-orders/[id]/submit'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await auth.supabase
    .from('purchase_orders')
    .update({ status: 'pending_approval' })
    .eq('id', id)
    .eq('status', 'draft')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ status: 'submitted', approved_by: null })
}
