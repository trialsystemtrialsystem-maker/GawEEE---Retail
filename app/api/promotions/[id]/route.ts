import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/promotions/:id { is_active } — manager+ only.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/promotions/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active wajib diisi' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.from('promotions').update({ is_active: body.is_active }).eq('id', id).select().single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ promotion: data })
}
