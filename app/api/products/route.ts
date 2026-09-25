import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, productSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'
import { marginOf } from '@/lib/utils/pricing'

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  name: { column: 'name', ascending: true },
  newest: { column: 'created_at', ascending: false },
  price_high: { column: 'selling_price', ascending: false },
  price_low: { column: 'selling_price', ascending: true },
}

// GET /api/products — company catalog. Soft-deleted products are excluded
// (they used to be listed as if still active). Filters: search (name / SKU /
// barcode), category_id, status (active|inactive), product_type, sort, paging.
// `summary` (whole catalog, not the page) drives the catalog health cards.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '50') || 50), 200)
  const search = searchParams.get('search')?.trim().replace(/[%,()]/g, '')
  const categoryId = searchParams.get('category_id')
  const status = searchParams.get('status')
  const productType = searchParams.get('product_type')
  const sort = SORTS[searchParams.get('sort') ?? 'name'] ?? SORTS.name

  let query = ctx.supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('company_id', ctx.company_id)
    .is('deleted_at', null)
    .order(sort.column, { ascending: sort.ascending })

  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
  if (categoryId === 'none') query = query.is('category_id', null)
  else if (categoryId) query = query.eq('category_id', categoryId)
  if (status) query = query.eq('is_active', status === 'active')
  if (productType === 'goods' || productType === 'service') query = query.eq('product_type', productType)

  const from = (page - 1) * limit
  const { data, error, count } = await query.range(from, from + limit - 1)

  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  const { data: all } = await selectAll(
    ctx.supabase.from('products').select('is_active, category_id, supplier_id, purchase_price, selling_price, product_type').eq('company_id', ctx.company_id).is('deleted_at', null)
  )
  const rows = all ?? []
  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    inactive: rows.filter((r) => !r.is_active).length,
    no_category: rows.filter((r) => !r.category_id).length,
    no_supplier: rows.filter((r) => !r.supplier_id && r.product_type !== 'service').length,
    low_margin: rows.filter((r) => r.is_active && r.selling_price > 0 && (marginOf(r.purchase_price, r.selling_price) ?? 1) < 0.1).length,
    below_cost: rows.filter((r) => r.is_active && r.selling_price > 0 && r.selling_price < r.purchase_price).length,
  }

  return NextResponse.json({
    data,
    summary,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}

// POST /api/products — see prd.md §4.2. Requires outlet_manager or master_admin.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(productSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: existing } = await ctx.supabase.from('products').select('id').eq('company_id', ctx.company_id).ilike('sku', result.data.sku).is('deleted_at', null).maybeSingle()
  if (existing) return NextResponse.json({ error: `SKU "${result.data.sku}" sudah dipakai produk lain` }, { status: 409 })

  const { data, error } = await ctx.supabase
    .from('products')
    .insert({ ...result.data, company_id: ctx.company_id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ product: data, created_at: data.created_at }, { status: 201 })
}
