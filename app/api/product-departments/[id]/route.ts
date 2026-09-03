import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// DELETE /api/product-departments/:id — manager+ only. Categories pointing
// at this department keep their department_id nullable, so removing a
// department doesn't cascade-delete any category (no FK cascade set).
export async function DELETE(_request: Request, ctx: RouteContext<'/api/product-departments/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  await auth.supabase.from('product_categories').update({ department_id: null }).eq('department_id', id)
  const { error } = await auth.supabase.from('product_departments').delete().eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
