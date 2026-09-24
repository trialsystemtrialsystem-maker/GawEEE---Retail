import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { fetchAllRows } from '@/lib/utils/fetchAll'
import { suggestTransfers } from '@/lib/utils/inventoryAnalytics'

type Row = {
  outlet_id: string
  product_id: string
  quantity_on_hand: number
  reorder_level: number | null
  outlets: { name: string } | { name: string }[] | null
  products: { name: string; sku: string; purchase_price: number; reorder_level: number; product_categories: { name: string } | null } | null
}

// GET /api/inventory/overview — stock of every product across every outlet the
// caller may see (RLS scopes it: an owner sees all outlets, a manager theirs),
// plus suggestions for moving surplus to outlets running short.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await fetchAllRows<Row>((from, to) =>
      auth.supabase
        .from('inventory')
        .select('outlet_id, product_id, quantity_on_hand, reorder_level, outlets(name), products(name, sku, purchase_price, reorder_level, product_categories(name))')
        .order('product_id')
        .order('outlet_id')
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    )

    const outlets = new Map<string, string>()
    const byProduct = new Map<string, { product_id: string; name: string; sku: string; category: string | null; price: number; stocks: { outlet_id: string; outlet_name: string; quantity: number; reorder_level: number }[] }>()
    for (const r of rows) {
      const o = Array.isArray(r.outlets) ? r.outlets[0] : r.outlets
      const outletName = o?.name ?? '-'
      outlets.set(r.outlet_id, outletName)
      const p = byProduct.get(r.product_id) ?? { product_id: r.product_id, name: r.products?.name ?? '-', sku: r.products?.sku ?? '', category: r.products?.product_categories?.name ?? null, price: r.products?.purchase_price ?? 0, stocks: [] }
      p.stocks.push({ outlet_id: r.outlet_id, outlet_name: outletName, quantity: r.quantity_on_hand, reorder_level: r.reorder_level ?? r.products?.reorder_level ?? 0 })
      byProduct.set(r.product_id, p)
    }

    const products = Array.from(byProduct.values())
      .map((p) => ({
        product_id: p.product_id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        total_quantity: p.stocks.reduce((s, x) => s + x.quantity, 0),
        total_value: p.stocks.reduce((s, x) => s + x.quantity, 0) * p.price,
        stocks: p.stocks,
        transfers: suggestTransfers(p.stocks),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ outlets: Array.from(outlets.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)), products })
  } catch (e) {
    const { status, message } = handleDatabaseError(e as Parameters<typeof handleDatabaseError>[0])
    return NextResponse.json({ error: message }, { status })
  }
}
