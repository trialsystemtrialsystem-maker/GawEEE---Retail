import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/purchase-returns/:id/submit — manager+ only. Atomically applies
// the return's line items to inventory via submit_purchase_return().
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/purchase-returns/[id]/submit'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase.rpc('submit_purchase_return', {
    p_return_id: id,
    p_submitted_by: auth.id,
  })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ total_amount: data?.[0]?.total_amount ?? 0 })
}
