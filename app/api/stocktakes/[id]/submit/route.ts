import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postStockValueJournal } from '@/lib/utils/journalPosting'

// POST /api/stocktakes/:id/submit — manager+ only. Atomically applies every
// counted-vs-expected variance to inventory via submit_stocktake().
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/stocktakes/[id]/submit'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase.rpc('submit_stocktake', {
    p_stocktake_id: id,
    p_submitted_by: auth.id,
  })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const variance = Number(data?.[0]?.total_variance_value ?? 0)
  const { data: st } = await auth.supabase.from('stocktakes').select('outlet_id').eq('id', id).single()
  if (st) {
    // Net counted-vs-system difference at cost (negative = shrinkage).
    await postStockValueJournal(auth.supabase, {
      outletId: st.outlet_id,
      createdBy: auth.id,
      date: new Date().toISOString().slice(0, 10),
      description: 'Selisih stok opname',
      sourceType: 'stocktake',
      sourceId: id,
      value: variance,
    })
  }

  return NextResponse.json({ total_variance_value: variance })
}
