import { NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// DELETE /api/held-transactions/:id — removes a held cart from the queue,
// used once its snapshot has been resumed back into the POS store.
export async function DELETE(_request: Request, ctx: RouteContext<'/api/held-transactions/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data: existing } = await auth.supabase.from('held_transactions').select('outlet_id').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, existing.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { error } = await auth.supabase.from('held_transactions').delete().eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
