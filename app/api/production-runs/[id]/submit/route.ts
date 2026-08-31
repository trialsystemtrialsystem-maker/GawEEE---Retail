import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/production-runs/:id/submit — manager+ only. Atomically consumes
// ingredients and adds the finished-good output via submit_production_run().
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/production-runs/[id]/submit'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase.rpc('submit_production_run', { p_run_id: id, p_submitted_by: auth.id })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ output_quantity: data?.[0]?.produced_quantity ?? 0 })
}
