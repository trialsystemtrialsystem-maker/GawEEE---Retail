import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/stock-turnover?outlet_id=&days=30 — COGS sold per product
// over the period, divided by that product's *current* inventory value as a
// turnover ratio. Simplification: a true average inventory value would need
// historical daily snapshots, which this schema doesn't keep — current stock
// value is used as the denominator instead (clearly labeled in the UI).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const days = Math.min(Number(searchParams.get('days') ?? '30'), 180)
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const start = new Date()
  start.setDate(start.getDate() - days + 1)

  const [itemsRes, inventoryRes] = await Promise.all([
    auth.supabase
      .from('invoice_items')
      .select('product_id, cost_of_goods_sold, products(name), invoices!inner(outlet_id, created_at, order_status)')
      .eq('invoices.outlet_id', outletId)
      .neq('invoices.order_status', 'voided')
      .gte('invoices.created_at', start.toISOString()),
    auth.supabase
      .from('inventory')
      .select('product_id, quantity_on_hand, products(purchase_price, name)')
      .eq('outlet_id', outletId),
  ])

  if (itemsRes.error) {
    const { status, message } = handleDatabaseError(itemsRes.error)
    return NextResponse.json({ error: message }, { status })
  }
  if (inventoryRes.error) {
    const { status, message } = handleDatabaseError(inventoryRes.error)
    return NextResponse.json({ error: message }, { status })
  }

  type ItemRow = { product_id: string; cost_of_goods_sold: number | null; products: { name: string } | { name: string }[] | null }
  const cogsByProduct = new Map<string, { name: string; cogs: number }>()
  for (const row of (itemsRes.data ?? []) as unknown as ItemRow[]) {
    const productMeta = Array.isArray(row.products) ? row.products[0] : row.products
    const entry = cogsByProduct.get(row.product_id) ?? { name: productMeta?.name ?? 'Produk', cogs: 0 }
    entry.cogs += row.cost_of_goods_sold ?? 0
    cogsByProduct.set(row.product_id, entry)
  }

  type InvRow = { product_id: string; quantity_on_hand: number; products: { purchase_price: number; name: string } | { purchase_price: number; name: string }[] | null }
  const stockValueByProduct = new Map<string, { name: string; value: number }>()
  for (const row of (inventoryRes.data ?? []) as unknown as InvRow[]) {
    const productMeta = Array.isArray(row.products) ? row.products[0] : row.products
    if (!productMeta) continue
    stockValueByProduct.set(row.product_id, { name: productMeta.name, value: row.quantity_on_hand * productMeta.purchase_price })
  }

  const productIds = new Set([...cogsByProduct.keys(), ...stockValueByProduct.keys()])
  const rows = Array.from(productIds).map((id) => {
    const cogsEntry = cogsByProduct.get(id)
    const stockEntry = stockValueByProduct.get(id)
    const cogs = cogsEntry?.cogs ?? 0
    const stockValue = stockEntry?.value ?? 0
    return {
      product_id: id,
      name: cogsEntry?.name ?? stockEntry?.name ?? 'Produk',
      cogs_sold: cogs,
      current_stock_value: stockValue,
      turnover_ratio: stockValue > 0 ? Math.round((cogs / stockValue) * 100) / 100 : null,
    }
  })

  rows.sort((a, b) => (b.turnover_ratio ?? 0) - (a.turnover_ratio ?? 0))

  return NextResponse.json({ rows, days })
}
