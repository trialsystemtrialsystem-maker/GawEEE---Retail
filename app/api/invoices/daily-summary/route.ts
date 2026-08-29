import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/invoices/daily-summary — see prd.md §4.3
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) {
    return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`

  const { data: invoices } = await auth.supabase
    .from('invoices')
    .select('*, invoice_items(quantity)')
    .eq('outlet_id', auth.outlet_id)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)

  const { data: payments } = await auth.supabase
    .from('payment_transactions')
    .select('payment_method, amount, status, invoice_id, invoices!inner(outlet_id)')
    .eq('invoices.outlet_id', auth.outlet_id)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)

  const active = (invoices ?? []).filter((i) => i.order_status !== 'voided')
  const voided = (invoices ?? []).filter((i) => i.order_status === 'voided')

  const totalSales = active.reduce((s, i) => s + i.total, 0)
  const totalDiscount = active.reduce((s, i) => s + i.discount_amount, 0)
  const itemsSold = active.reduce(
    (s, i) => s + ((i as unknown as { invoice_items: { quantity: number }[] }).invoice_items ?? []).reduce((a, b) => a + b.quantity, 0),
    0
  )
  const uniqueCustomers = new Set(active.map((i) => i.customer_phone).filter(Boolean)).size

  const sumByMethod = (method: string) =>
    (payments ?? []).filter((p) => p.payment_method === method).reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    date: today,
    total_sales: totalSales,
    cash_sales: sumByMethod('cash'),
    e_wallet_sales: sumByMethod('e_wallet'),
    bank_transfer_pending: (payments ?? [])
      .filter((p) => p.payment_method === 'bank_transfer' && p.status === 'pending')
      .reduce((s, p) => s + p.amount, 0),
    total_discount: totalDiscount,
    transaction_count: active.length,
    items_sold: itemsSold,
    unique_customers: uniqueCustomers,
    voided_transactions: voided.map((v) => ({ id: v.id, invoice_number: v.invoice_number, total: v.total })),
  })
}
