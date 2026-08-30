import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, onlineOrderStatusSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { canTransition } from '@/lib/utils/onlineOrders'

// PATCH /api/online-orders/:id/status — validates the transition before writing.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/online-orders/[id]/status'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(onlineOrderStatusSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { id } = await ctx.params

  const { data: existing, error: fetchError } = await auth.supabase
    .from('online_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) {
    const { status, message } = handleDatabaseError(fetchError)
    return NextResponse.json({ error: message }, { status })
  }

  if (!canTransition(existing.status, result.data.status)) {
    return NextResponse.json(
      { error: `Tidak bisa mengubah status dari "${existing.status}" ke "${result.data.status}"` },
      { status: 400 }
    )
  }

  const { data, error } = await auth.supabase
    .from('online_orders')
    .update({ status: result.data.status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ order: data })
}
