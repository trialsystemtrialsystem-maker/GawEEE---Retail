import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// DELETE /api/product-units/:id — RLS (via the owning product's company_id)
// is the only access check needed here, same as other company-scoped child tables.
export async function DELETE(_request: Request, ctx: RouteContext<'/api/product-units/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { error } = await auth.supabase.from('product_units').delete().eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
