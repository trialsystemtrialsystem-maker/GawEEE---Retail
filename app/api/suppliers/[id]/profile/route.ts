import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { deliveryStats, priceTrends } from '@/lib/utils/supplierMetrics'

type PoRow = {
  id: string
  po_number: string
  status: string
  order_date: string
  requested_delivery_date: string | null
  actual_delivery_date: string | null
  total: number | null
  outlets: { name: string } | { name: string }[] | null
  po_items: { product_id: string; quantity_ordered: number; quantity_received: number; unit_cost: number; products: { name: string; sku: string } | { name: string; sku: string }[] | null }[]
}
type InvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total: number | null
  payment_status: string
  purchase_payments: { amount: number }[]
}

const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v)

// GET /api/suppliers/:id/profile — Supplier 360: delivery performance, what is
// owed, and what has been bought at which price. Everything is derived from the
// purchase orders / invoices / payments the supplier already has, and RLS keeps
// a manager to their own outlets' orders.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/suppliers/[id]/profile'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data: supplier } = await auth.supabase.from('suppliers').select('*').eq('id', id).eq('company_id', auth.company_id).is('deleted_at', null).single()
  if (!supplier) return NextResponse.json({ error: 'Supplier tidak ditemukan' }, { status: 404 })

  const [poRes, invRes] = await Promise.all([
    auth.supabase
      .from('purchase_orders')
      .select('id, po_number, status, order_date, requested_delivery_date, actual_delivery_date, total, outlets(name), po_items(product_id, quantity_ordered, quantity_received, unit_cost, products(name, sku))')
      .eq('supplier_id', id)
      .order('order_date', { ascending: false })
      .limit(500),
    auth.supabase
      .from('purchase_invoices')
      .select('id, invoice_number, invoice_date, due_date, total, payment_status, purchase_payments(amount)')
      .eq('supplier_id', id)
      .order('invoice_date', { ascending: false })
      .limit(500),
  ])
  for (const r of [poRes, invRes]) {
    if (r.error) {
      const { status, message } = handleDatabaseError(r.error)
      return NextResponse.json({ error: message }, { status })
    }
  }

  const pos = (poRes.data ?? []) as unknown as PoRow[]
  const invoices = (invRes.data ?? []) as unknown as InvoiceRow[]
  const real = pos.filter((p) => !['draft', 'cancelled', 'rejected'].includes(p.status))
  const today = new Date().toISOString().slice(0, 10)

  const invoiceRows = invoices.map((i) => {
    const paid = (i.purchase_payments ?? []).reduce((s, p) => s + p.amount, 0)
    const balance = Math.max(0, (i.total ?? 0) - paid)
    return { id: i.id, invoice_number: i.invoice_number, invoice_date: i.invoice_date, due_date: i.due_date, total: i.total ?? 0, paid, balance, payment_status: i.payment_status, overdue: balance > 0 && i.due_date < today }
  })

  const byProduct = new Map<string, { product_id: string; name: string; sku: string; quantity: number; spend: number }>()
  const points: { product_id: string; date: string; unit_cost: number }[] = []
  for (const p of real) {
    for (const it of p.po_items ?? []) {
      const prod = one(it.products)
      const e = byProduct.get(it.product_id) ?? { product_id: it.product_id, name: prod?.name ?? '-', sku: prod?.sku ?? '', quantity: 0, spend: 0 }
      e.quantity += it.quantity_ordered
      e.spend += it.quantity_ordered * it.unit_cost
      byProduct.set(it.product_id, e)
      points.push({ product_id: it.product_id, date: p.order_date, unit_cost: it.unit_cost })
    }
  }
  const trends = new Map(priceTrends(points).map((t) => [t.product_id, t]))

  return NextResponse.json({
    supplier,
    kpi: {
      po_count: real.length,
      total_purchased: real.reduce((s, p) => s + (p.total ?? 0), 0),
      outstanding: invoiceRows.reduce((s, i) => s + i.balance, 0),
      overdue: invoiceRows.filter((i) => i.overdue).reduce((s, i) => s + i.balance, 0),
      ...deliveryStats(real),
    },
    products: Array.from(byProduct.values())
      .map((p) => ({ ...p, trend: trends.get(p.product_id) ?? null }))
      .sort((a, b) => b.spend - a.spend),
    purchase_orders: pos.slice(0, 30).map((p) => ({ id: p.id, po_number: p.po_number, status: p.status, order_date: p.order_date, actual_delivery_date: p.actual_delivery_date, total: p.total ?? 0, outlet_name: one(p.outlets)?.name ?? '-' })),
    invoices: invoiceRows.slice(0, 30),
  })
}
