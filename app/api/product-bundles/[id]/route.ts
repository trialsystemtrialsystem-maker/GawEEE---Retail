import { NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// DELETE /api/product-bundles/:id — soft-delete (is_active=false) rather
// than a hard delete, so past invoices/receipts referencing the bundle name
// in a discount_reason stay meaningful even after the bundle is retired.
export async function DELETE(_request: Request, ctx: RouteContext<'/api/product-bundles/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data: existing } = await auth.supabase.from('product_bundles').select('outlet_id').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, existing.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { error } = await auth.supabase.from('product_bundles').update({ is_active: false }).eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
