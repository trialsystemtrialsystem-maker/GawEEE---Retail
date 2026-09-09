import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

type ItemRow = { product_id: string; quantity: number; unit_price: number; item_discount: number; products: { name: string; product_type: string } | null }

// GET /api/reports/service — revenue/count per service product, last 30 days.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const start = new Date()
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)

  const { data, error } = await auth.supabase
    .from('invoice_items')
    .select('product_id, quantity, unit_price, item_discount, products!inner(name, product_type), invoices!inner(outlet_id, created_at, order_status)')
    .eq('invoices.outlet_id', auth.outlet_id)
    .eq('products.product_type', 'service')
    .neq('invoices.order_status', 'voided')
    .gte('invoices.created_at', start.toISOString())

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const rows = (data ?? []) as unknown as ItemRow[]
  const byService = new Map<string, { name: string; count: number; revenue: number }>()
  let totalRevenue = 0
  let totalCount = 0
  for (const r of rows) {
    const revenue = r.quantity * r.unit_price - r.item_discount
    const entry = byService.get(r.product_id) ?? { name: r.products?.name ?? 'Layanan', count: 0, revenue: 0 }
    entry.count += r.quantity
    entry.revenue += revenue
    byService.set(r.product_id, entry)
    totalRevenue += revenue
    totalCount += r.quantity
  }

  const services = Array.from(byService.entries())
    .map(([productId, v]) => ({ product_id: productId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json({ services, totalRevenue, totalCount })
}
