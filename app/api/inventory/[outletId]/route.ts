import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { abcClassify, daysOfCover, stockHealth, suggestedReorderQty } from '@/lib/utils/inventoryAnalytics'

type Row = {
  product_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  alert_status: string
  reorder_level: number | null
  products: {
    name: string
    sku: string
    barcode: string | null
    category_id: string | null
    purchase_price: number
    selling_price: number
    unit_type: string
    reorder_level: number
    reorder_quantity: number
    supplier_id: string | null
    is_active: boolean
    product_categories: { name: string } | null
    suppliers: { name: string } | null
  } | null
}

const WINDOW_DAYS = 60

// GET /api/inventory/:outlet_id — see prd.md §4.2. Beyond the raw stock it
// returns what an owner needs to decide: reorder level in effect, selling pace
// over the last 30/60 days, days of cover, dead/slow classification, ABC class
// by stock value, and a suggested reorder quantity.
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
  const statusFilter = searchParams.get('status') // 'low_stock' | 'normal' | 'overstock' | 'out_of_stock'
  const categoryId = searchParams.get('category_id')
  // The POS and pickers call this on every load and only need stock; the selling-
  // pace analytics scan 60 days of invoice lines, so they are opt-in (?analytics=1).
  const withAnalytics = searchParams.get('analytics') === '1'

  const { data: outlet } = await auth.supabase.from('outlets').select('*').eq('id', outletId).single()
  if (!outlet) return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 404 })

  try {
    const rowsRaw = await fetchAllRows<Row>((from, to) => {
      let query = auth.supabase
        .from('inventory')
        .select(
          'product_id, quantity_on_hand, quantity_reserved, quantity_available, alert_status, reorder_level, products(name, sku, barcode, category_id, purchase_price, selling_price, unit_type, reorder_level, reorder_quantity, supplier_id, is_active, product_categories(name), suppliers(name))'
        )
        .eq('outlet_id', outletId)
        .order('product_id')
        .range(from, to)
      if (statusFilter) query = query.eq('alert_status', statusFilter as 'normal' | 'low_stock' | 'overstock' | 'out_of_stock' | 'expired')
      return query as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    })

    let rows = rowsRaw
    if (barcode) rows = rows.filter((r) => r.products?.barcode === barcode)
    else if (search) {
      const needle = search.toLowerCase()
      rows = rows.filter((r) => r.products?.name.toLowerCase().includes(needle) || r.products?.sku.toLowerCase().includes(needle))
    }
    if (categoryId) rows = rows.filter((r) => r.products?.category_id === categoryId)

    // Selling pace: units sold per product over the last 60 days (non-voided).
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
    const since30 = Date.now() - 30 * 86_400_000
    const sales = !withAnalytics ? [] : await fetchAllRows<{ product_id: string; quantity: number; invoices: { created_at: string } | { created_at: string }[] }>((from, to) =>
      auth.supabase
        .from('invoice_items')
        .select('product_id, quantity, invoices!inner(created_at, outlet_id, order_status)')
        .eq('invoices.outlet_id', outletId)
        .neq('invoices.order_status', 'voided')
        .gte('invoices.created_at', since)
        .order('created_at')
        .range(from, to) as unknown as PromiseLike<{ data: { product_id: string; quantity: number; invoices: { created_at: string } | { created_at: string }[] }[] | null; error: { message: string } | null }>
    )
    const sold30 = new Map<string, number>()
    const sold60 = new Map<string, number>()
    for (const s of sales) {
      const inv = Array.isArray(s.invoices) ? s.invoices[0] : s.invoices
      sold60.set(s.product_id, (sold60.get(s.product_id) ?? 0) + s.quantity)
      if (inv && Date.parse(inv.created_at) >= since30) sold30.set(s.product_id, (sold30.get(s.product_id) ?? 0) + s.quantity)
    }

    const base = rows.map((r) => {
      const p = r.products
      const reorderLevel = r.reorder_level ?? p?.reorder_level ?? 0
      const avgDaily = (sold30.get(r.product_id) ?? 0) / 30
      return {
        product_id: r.product_id,
        sku: p?.sku,
        barcode: p?.barcode,
        name: p?.name,
        category_id: p?.category_id ?? null,
        category_name: p?.product_categories?.name ?? null,
        supplier_id: p?.supplier_id ?? null,
        supplier_name: p?.suppliers?.name ?? null,
        unit_type: p?.unit_type ?? '',
        unit_price: p?.selling_price ?? 0,
        purchase_price: p?.purchase_price ?? 0,
        quantity_on_hand: r.quantity_on_hand,
        quantity_reserved: r.quantity_reserved,
        quantity_available: r.quantity_available,
        reorder_level: reorderLevel,
        reorder_quantity: p?.reorder_quantity ?? 0,
        cost_value: (p?.purchase_price ?? 0) * r.quantity_on_hand,
        retail_value: (p?.selling_price ?? 0) * r.quantity_on_hand,
        margin_pct: p && p.selling_price > 0 ? Math.round(((p.selling_price - p.purchase_price) / p.selling_price) * 1000) / 10 : null,
        status: r.alert_status,
        sold_30d: sold30.get(r.product_id) ?? 0,
        sold_60d: sold60.get(r.product_id) ?? 0,
        avg_daily_sales: Math.round(avgDaily * 100) / 100,
        days_of_cover: daysOfCover(r.quantity_on_hand, avgDaily),
        health: stockHealth(r.quantity_on_hand, sold60.get(r.product_id) ?? 0, WINDOW_DAYS),
        suggested_reorder: suggestedReorderQty({ onHand: r.quantity_on_hand, reorderLevel, reorderQuantity: p?.reorder_quantity ?? 0, avgDailySales: avgDaily }),
      }
    })

    const abc = abcClassify(base.map((b) => ({ id: b.product_id, value: b.cost_value })))
    const inventory = base.map((b) => ({ ...b, abc_class: abc.get(b.product_id) ?? 'C' }))

    const totalValueOnHand = inventory.reduce((sum, i) => sum + i.cost_value, 0)
    const totalRetailValue = inventory.reduce((sum, i) => sum + i.retail_value, 0)

    return NextResponse.json({
      outlet,
      inventory,
      total_value_on_hand: totalValueOnHand,
      total_retail_value: totalRetailValue,
      summary: {
        sku_count: inventory.length,
        low_stock: inventory.filter((i) => i.status === 'low_stock').length,
        out_of_stock: inventory.filter((i) => i.status === 'out_of_stock').length,
        dead_stock: inventory.filter((i) => i.health === 'dead').length,
        needs_reorder: inventory.filter((i) => i.suggested_reorder > 0).length,
        dead_stock_value: inventory.filter((i) => i.health === 'dead').reduce((s, i) => s + i.cost_value, 0),
      },
    })
  } catch (e) {
    const { status, message } = handleDatabaseError(e as Parameters<typeof handleDatabaseError>[0])
    return NextResponse.json({ error: message }, { status })
  }
}
