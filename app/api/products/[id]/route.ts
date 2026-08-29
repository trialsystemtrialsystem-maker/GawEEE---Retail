import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/products/:id — see prd.md §4.2
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/products/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: product, error } = await auth.supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('company_id', auth.company_id)
    .single()

  if (error || !product) {
    return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
  }

  const { data: inventoryByOutlet } = await auth.supabase
    .from('inventory')
    .select('outlet_id, quantity_on_hand, outlets(name)')
    .eq('product_id', id)

  return NextResponse.json({
    product,
    inventory_by_outlet: inventoryByOutlet ?? [],
  })
}

// PUT /api/products/:id — see prd.md §4.2. Requires outlet_manager or master_admin.
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/products/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()

  const { data, error } = await auth.supabase
    .from('products')
    .update(body)
    .eq('id', id)
    .eq('company_id', auth.company_id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ product: data, updated_at: data.updated_at })
}

// DELETE /api/products/:id — soft-delete, see prd.md §4.2
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/products/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { error } = await auth.supabase
    .from('products')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.company_id)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ status: 'product_deleted' })
}
