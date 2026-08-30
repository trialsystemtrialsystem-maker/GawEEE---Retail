import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/inventory/:outlet_id — see prd.md §4.2
export async function GET(request: NextRequest, ctx: RouteContext<'/api/inventory/[outletId]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { outletId } = await ctx.params
  if (!canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')
  const barcode = searchParams.get('barcode')
  const statusFilter = searchParams.get('status') // 'low_stock' | 'normal' | 'overstock'
  const categoryId = searchParams.get('category_id')

  const { data: outlet } = await auth.supabase.from('outlets').select('*').eq('id', outletId).single()
  if (!outlet) return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 404 })

  let query = auth.supabase
    .from('inventory')
    .select('product_id, quantity_on_hand, quantity_reserved, quantity_available, alert_status, products(name, sku, barcode, category_id, purchase_price, selling_price, product_categories(name))')
    .eq('outlet_id', outletId)

  if (statusFilter) {
    query = query.eq(
      'alert_status',
      statusFilter as 'normal' | 'low_stock' | 'overstock' | 'out_of_stock' | 'expired'
    )
  }

  const { data, error } = await query

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  type Row = {
    product_id: string
    quantity_on_hand: number
    quantity_reserved: number
    quantity_available: number
    alert_status: string
    products: {
      name: string
      sku: string
      barcode: string | null
      category_id: string | null
      purchase_price: number
      selling_price: number
      product_categories: { name: string } | null
    } | null
  }

  let rows = (data ?? []) as unknown as Row[]
  if (barcode) {
    rows = rows.filter((r) => r.products?.barcode === barcode)
  } else if (search) {
    const needle = search.toLowerCase()
    rows = rows.filter((r) => r.products?.name.toLowerCase().includes(needle))
  }
  if (categoryId) {
    rows = rows.filter((r) => r.products?.category_id === categoryId)
  }

  const inventory = rows.map((r) => ({
    product_id: r.product_id,
    sku: r.products?.sku,
    barcode: r.products?.barcode,
    name: r.products?.name,
    category_name: r.products?.product_categories?.name ?? null,
    unit_price: r.products?.selling_price ?? 0,
    quantity_on_hand: r.quantity_on_hand,
    quantity_reserved: r.quantity_reserved,
    quantity_available: r.quantity_available,
    cost_value: (r.products?.purchase_price ?? 0) * r.quantity_on_hand,
    retail_value: (r.products?.selling_price ?? 0) * r.quantity_on_hand,
    status: r.alert_status,
  }))

  const totalValueOnHand = inventory.reduce((sum, i) => sum + i.cost_value, 0)
  const totalRetailValue = inventory.reduce((sum, i) => sum + i.retail_value, 0)

  return NextResponse.json({
    outlet,
    inventory,
    total_value_on_hand: totalValueOnHand,
    total_retail_value: totalRetailValue,
  })
}
