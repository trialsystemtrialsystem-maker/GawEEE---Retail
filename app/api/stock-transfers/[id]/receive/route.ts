import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/stock-transfers/:id/receive — manager+ only. Atomically adds
// stock to the destination outlet via receive_stock_transfer().
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/stock-transfers/[id]/receive'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase.rpc('receive_stock_transfer', { p_transfer_id: id, p_received_by: auth.id })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ received_at: data?.[0]?.received_at })
}
