import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/abc-analysis?outlet_id=&days=90&start=&end= — Pareto
// (ABC) product classification by revenue contribution, standard in
// enterprise retail/merchandising systems (SAP Retail, Oracle Retail) for
// deciding which products get the tightest stock control and shelf
// priority: class A is the small set of products driving most revenue, C
// is the long tail. Class boundaries follow the standard convention (A up
// to 80% cumulative revenue, B up to 95%, C the rest) — the product whose
// cumulative sum crosses a threshold is counted in the class it crosses into.
type Row = {
  product_id: string
  quantity: number
  subtotal: number
  cost_of_goods_sold: number | null
  products: { name: string } | null
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const { startIso, endIso } = resolveDateRange(searchParams, 90, 365)

  const { data, error } = await auth.supabase
    .from('invoice_items')
    .select('product_id, quantity, subtotal, cost_of_goods_sold, products(name), invoices!inner(outlet_id, order_status, created_at)')
    .in('invoices.outlet_id', outletIds)
    .neq('invoices.order_status', 'voided')
    .gte('invoices.created_at', startIso)
    .lte('invoices.created_at', endIso)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const byProduct = new Map<string, { product_id: string; name: string; units_sold: number; revenue: number; cogs: number }>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const entry = byProduct.get(row.product_id) ?? { product_id: row.product_id, name: row.products?.name ?? '-', units_sold: 0, revenue: 0, cogs: 0 }
    entry.units_sold += row.quantity
    entry.revenue += row.subtotal
    entry.cogs += row.cost_of_goods_sold ?? 0
    byProduct.set(row.product_id, entry)
  }

  const sorted = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = sorted.reduce((s, p) => s + p.revenue, 0)

  // Class is decided by the cumulative % *before* adding this product — so
  // the single product that pushes the running total past 80% still counts
  // as class A (the crossing itself belongs to the class it crosses into),
  // matching the standard ABC/Pareto convention.
  let cumulative = 0
  const products = sorted.map((p) => {
    const cumulativePctBefore = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0
    const cls: 'A' | 'B' | 'C' = cumulativePctBefore < 80 ? 'A' : cumulativePctBefore < 95 ? 'B' : 'C'
    cumulative += p.revenue
    const cumulativePctAfter = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0
    return {
      ...p,
      profit: p.revenue - p.cogs,
      revenue_pct: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      cumulative_pct: cumulativePctAfter,
      class: cls,
    }
  })

  const summary = (['A', 'B', 'C'] as const).map((cls) => {
    const inClass = products.filter((p) => p.class === cls)
    return {
      class: cls,
      product_count: inClass.length,
      revenue: inClass.reduce((s, p) => s + p.revenue, 0),
      revenue_pct: totalRevenue > 0 ? (inClass.reduce((s, p) => s + p.revenue, 0) / totalRevenue) * 100 : 0,
    }
  })

  return NextResponse.json({ products, summary, total_revenue: totalRevenue })
}
