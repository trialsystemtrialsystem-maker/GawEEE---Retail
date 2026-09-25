import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { customerSegment, normalizePhone, purchaseInterval, samePhone } from '@/lib/utils/customerInsights'

type InvoiceRow = { id: string; invoice_number: string; customer_phone: string | null; total: number; payment_status: string; order_status: string; created_at: string; outlets: { name: string } | { name: string }[] | null }
type ItemRow = { product_id: string; quantity: number; unit_price: number; item_discount: number; invoice_id: string; products: { name: string } | { name: string }[] | null }

const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v)

// GET /api/customers/:id/profile — Customer 360. Invoices have no customer FK,
// so history is matched on the normalized phone number (across every outlet the
// caller may see). Refunds and voided sales are excluded from lifetime value.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/customers/[id]/profile'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data: customer } = await auth.supabase.from('customers').select('*, customer_groups(name), outlets(name)').eq('id', id).single()
  if (!customer) return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })

  const phone = normalizePhone(customer.phone)
  let invoices: InvoiceRow[] = []
  if (phone) {
    const tail = phone.slice(-9)
    const { data, error } = await auth.supabase
      .from('invoices')
      .select('id, invoice_number, customer_phone, total, payment_status, order_status, created_at, outlets(name)')
      .ilike('customer_phone', `%${tail.slice(0, 4)}%`)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }
    invoices = ((data ?? []) as unknown as InvoiceRow[]).filter((i) => samePhone(i.customer_phone, customer.phone))
  }

  const valid = invoices.filter((i) => i.order_status !== 'voided')
  const ids = valid.slice(0, 300).map((i) => i.id)

  const [itemsRes, refundsRes, loyaltyRes] = await Promise.all([
    ids.length
      ? auth.supabase.from('invoice_items').select('product_id, quantity, unit_price, item_discount, invoice_id, products(name)').in('invoice_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? auth.supabase.from('customer_refunds').select('total_amount, status').in('invoice_id', valid.map((i) => i.id).slice(0, 300)).eq('status', 'completed')
      : Promise.resolve({ data: [], error: null }),
    auth.supabase.from('loyalty_ledger').select('id, points_change, reason, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  const gross = valid.reduce((s, i) => s + i.total, 0)
  const refunded = (refundsRes.data ?? []).reduce((s, r) => s + r.total_amount, 0)
  const spend = gross - refunded
  const lastAt = valid[0]?.created_at ?? null
  const daysSinceLast = lastAt ? Math.floor((Date.now() - Date.parse(lastAt)) / 86_400_000) : null
  const unpaid = valid.filter((i) => i.payment_status !== 'paid')
  const paidBy = new Map<string, number>()
  if (unpaid.length > 0) {
    const { data: settled } = await auth.supabase.from('payment_transactions').select('invoice_id, amount').eq('status', 'settled').in('invoice_id', unpaid.map((i) => i.id))
    for (const p of settled ?? []) paidBy.set(p.invoice_id, (paidBy.get(p.invoice_id) ?? 0) + p.amount)
  }

  const products = new Map<string, { name: string; quantity: number; spend: number }>()
  for (const it of (itemsRes.data ?? []) as unknown as ItemRow[]) {
    const e = products.get(it.product_id) ?? { name: one(it.products)?.name ?? '-', quantity: 0, spend: 0 }
    e.quantity += it.quantity
    e.spend += it.quantity * it.unit_price - it.item_discount
    products.set(it.product_id, e)
  }

  const byMonth = new Map<string, { orders: number; spend: number }>()
  for (const i of valid) {
    const m = i.created_at.slice(0, 7)
    const e = byMonth.get(m) ?? { orders: 0, spend: 0 }
    e.orders += 1
    e.spend += i.total
    byMonth.set(m, e)
  }

  const loyalty = loyaltyRes.data ?? []
  return NextResponse.json({
    customer,
    kpi: {
      orders: valid.length,
      spend,
      refunded,
      average_basket: valid.length ? Math.round(gross / valid.length) : 0,
      last_purchase_at: lastAt,
      days_since_last: daysSinceLast,
      purchase_interval_days: purchaseInterval(valid.map((i) => i.created_at)),
      unpaid_total: unpaid.reduce((s, i) => s + Math.max(0, i.total - (paidBy.get(i.id) ?? 0)), 0),
      unpaid_count: unpaid.length,
      loyalty_points: loyalty.reduce((s, l) => s + l.points_change, 0),
      segment: customerSegment({ orders: valid.length, spend, daysSinceLast }),
    },
    favorite_products: Array.from(products.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    monthly: Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([month, v]) => ({ month, ...v })),
    invoices: invoices.slice(0, 50).map((i) => ({ id: i.id, invoice_number: i.invoice_number, total: i.total, payment_status: i.payment_status, order_status: i.order_status, created_at: i.created_at, outlet_name: one(i.outlets)?.name ?? '-' })),
    loyalty: loyalty.slice(0, 20),
    phone_matched: !!phone,
  })
}
