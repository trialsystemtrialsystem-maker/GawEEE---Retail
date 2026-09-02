import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/leave-requests/:id/decide { decision: 'approved' | 'rejected' } — manager+ only.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/leave-requests/[id]/decide'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null
  if (!decision) return NextResponse.json({ error: 'decision harus approved atau rejected' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('leave_requests')
    .update({ status: decision, decided_by: auth.id, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ request: data })
}
