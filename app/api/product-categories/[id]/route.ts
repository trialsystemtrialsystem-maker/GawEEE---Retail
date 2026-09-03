import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/product-categories/:id — manager+ only. Used to assign/clear a
// category's department (the only field this UI needs to change today).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/product-categories/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  const departmentId = typeof body.department_id === 'string' || body.department_id === null ? body.department_id : undefined
  if (departmentId === undefined) return NextResponse.json({ error: 'department_id wajib diisi (boleh null)' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('product_categories')
    .update({ department_id: departmentId })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ category: data })
}
