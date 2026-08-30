import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

type InvoiceRow = {
  id: string
  total: number
  cashier_id: string
  created_at: string
  order_status: string
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  invoice_items: { product_id: string; quantity: number; unit_price: number; item_discount: number; products: { name: string } | null }[]
}

type PaymentRow = { payment_method: string; amount: number; invoices: { outlet_id: string } | { outlet_id: string }[] }

// GET /api/reports/sales-breakdown?days=30 — payment-method totals, best
// sellers, sales+commission per cashier, and a fraud-control watchlist of
// voided invoices, for the Sales Dashboard report grid (mockup images 1-3).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const days = Math.min(Number(request.nextUrl.searchParams.get('days') ?? '30'), 180)
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)

  const [invoicesRes, paymentsRes, usersRes, staffRes, lowStockRes] = await Promise.all([
    auth.supabase
      .from('invoices')
      .select(
        'id, total, cashier_id, created_at, order_status, voided_at, voided_by, void_reason, invoice_items(product_id, quantity, unit_price, item_discount, products(name))'
      )
      .eq('outlet_id', auth.outlet_id)
      .gte('created_at', start.toISOString()),
    auth.supabase
      .from('payment_transactions')
      .select('payment_method, amount, invoices!inner(outlet_id)')
      .eq('invoices.outlet_id', auth.outlet_id)
      .eq('status', 'settled')
      .gte('created_at', start.toISOString()),
    auth.supabase.from('users').select('id, full_name, email').eq('company_id', auth.company_id),
    auth.supabase.from('staff_members').select('email, commission_rate').eq('outlet_id', auth.outlet_id),
    auth.supabase
      .from('v_low_stock_alerts')
      .select('product_id, name, quantity_on_hand, reorder_level')
      .eq('outlet_id', auth.outlet_id)
      .limit(10),
  ])

  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[]
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[]
  const usersById = new Map((usersRes.data ?? []).map((u) => [u.id, u]))
  const commissionByEmail = new Map((staffRes.data ?? []).map((s) => [s.email, Number(s.commission_rate)]))

  // Payment method totals
  const paymentTotals = new Map<string, number>()
  for (const p of payments) {
    paymentTotals.set(p.payment_method, (paymentTotals.get(p.payment_method) ?? 0) + p.amount)
  }

  // Best-selling products + sales/commission per cashier + fraud watchlist
  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>()
  const cashierTotals = new Map<string, { name: string; revenue: number; transactions: number }>()
  const fraudWatchlist: { id: string; total: number; voided_at: string | null; voided_by_name: string; reason: string }[] = []

  for (const inv of invoices) {
    if (inv.order_status === 'voided') {
      fraudWatchlist.push({
        id: inv.id,
        total: inv.total,
        voided_at: inv.voided_at,
        voided_by_name: (inv.voided_by && usersById.get(inv.voided_by)?.full_name) || 'Tidak diketahui',
        reason: inv.void_reason ?? '-',
      })
      continue
    }

    const cashier = usersById.get(inv.cashier_id)
    const cashierEntry = cashierTotals.get(inv.cashier_id) ?? { name: cashier?.full_name ?? 'Kasir', revenue: 0, transactions: 0 }
    cashierEntry.revenue += inv.total
    cashierEntry.transactions += 1
    cashierTotals.set(inv.cashier_id, cashierEntry)

    for (const item of inv.invoice_items) {
      const revenue = item.quantity * item.unit_price - item.item_discount
      const entry = productTotals.get(item.product_id) ?? { name: item.products?.name ?? 'Produk', quantity: 0, revenue: 0 }
      entry.quantity += item.quantity
      entry.revenue += revenue
      productTotals.set(item.product_id, entry)
    }
  }

  const cashierSales = Array.from(cashierTotals.entries())
    .map(([cashierId, v]) => {
      const email = usersById.get(cashierId)?.email
      const rate = (email ? commissionByEmail.get(email) : undefined) ?? 0
      return { cashier_id: cashierId, name: v.name, revenue: v.revenue, transactions: v.transactions, commission: Math.round(v.revenue * rate) }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const bestProducts = Array.from(productTotals.entries())
    .map(([productId, v]) => ({ product_id: productId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const inStoreRevenue = invoices.filter((i) => i.order_status !== 'voided').reduce((s, i) => s + i.total, 0)

  return NextResponse.json({
    paymentMethods: Array.from(paymentTotals.entries()).map(([method, total]) => ({ method, total })),
    bestProducts,
    cashierSales,
    fraudWatchlist: fraudWatchlist.sort((a, b) => (b.voided_at ?? '').localeCompare(a.voided_at ?? '')),
    orderChannel: { inStore: inStoreRevenue, online: 0 },
    lowStock: lowStockRes.data ?? [],
  })
}
