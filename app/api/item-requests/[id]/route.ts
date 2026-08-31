import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, decideItemRequestSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/item-requests/:id { decision } — manager+ only for
// approve/reject; 'converted' can be set by anyone once they've manually
// created the real PO for this request (no auto-generation — see
// app/api/purchase-orders for that flow).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/item-requests/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(decideItemRequestSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (result.data.decision !== 'converted' && !['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase
    .from('item_requests')
    .update({ status: result.data.decision, decided_by: auth.id, decided_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ request: data })
}
