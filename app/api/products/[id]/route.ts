import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validate } from '@/lib/utils/validation'
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
// Editable product fields. The previous PUT handed the raw request body to
// .update(), so a caller could overwrite columns such as company_id or
// deleted_at; only these are accepted now.
const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    sku: z.string().trim().min(1).max(100),
    barcode: z.string().trim().max(100).nullable(),
    description: z.string().trim().max(1000).nullable(),
    brand: z.string().trim().max(100).nullable(),
    category_id: z.string().uuid().nullable(),
    supplier_id: z.string().uuid().nullable(),
    purchase_price: z.number().min(0).max(1e12),
    selling_price: z.number().min(0).max(1e12),
    unit_type: z.string().trim().min(1).max(50),
    tax_rate: z.number().min(0).max(100).nullable(),
    reorder_level: z.number().int().min(0).max(1e7),
    reorder_quantity: z.number().int().min(0).max(1e7),
    shelf_life_days: z.number().int().min(0).max(36500).nullable(),
    image_url: z.string().trim().url().max(500).nullable(),
    is_active: z.boolean(),
  })
  .partial()

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/products/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const result = validate(updateSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  if (Object.keys(result.data).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

  if (result.data.sku) {
    const { data: clash } = await auth.supabase.from('products').select('id').eq('company_id', auth.company_id).ilike('sku', result.data.sku).neq('id', id).is('deleted_at', null).maybeSingle()
    if (clash) return NextResponse.json({ error: `SKU "${result.data.sku}" sudah dipakai produk lain` }, { status: 409 })
  }

  const { data, error } = await auth.supabase
    .from('products')
    .update(result.data)
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
