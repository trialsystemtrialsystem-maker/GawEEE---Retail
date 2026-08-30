import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/reports/daily-summary — see prd.md §4.6.
//
// Computed live from invoices/invoice_items rather than read from
// daily_financial_summary, since nothing populates that table yet (it's
// meant to be filled by a nightly job — see roadmap.md's materialized-view
// note; out of scope until Phase 2's scheduling infra exists).
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`

  // Independent queries — run in parallel rather than sequentially awaited,
  // since each round-trip adds its own network latency (was ~3s combined,
  // now bounded by whichever single query is slowest).
  const [{ data: invoices }, { data: payments }, { data: outlet }, { data: lowStock }] = await Promise.all([
    auth.supabase
      .from('invoices')
      .select('*, invoice_items(quantity, cost_of_goods_sold)')
      .eq('outlet_id', auth.outlet_id)
      .neq('order_status', 'voided')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    auth.supabase
      .from('payment_transactions')
      .select('payment_method, amount, invoices!inner(outlet_id)')
      .eq('invoices.outlet_id', auth.outlet_id)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    auth.supabase.from('outlets').select('opening_cash').eq('id', auth.outlet_id).single(),
    auth.supabase.from('v_low_stock_alerts').select('name').eq('outlet_id', auth.outlet_id).limit(5),
  ])

  const rows = invoices ?? []
  const totalSales = rows.reduce((s, i) => s + i.total, 0)
  const totalDiscount = rows.reduce((s, i) => s + i.discount_amount, 0)
  const taxCollected = rows.reduce((s, i) => s + i.tax_amount, 0)
  const cogs = rows.reduce(
    (s, i) =>
      s +
      ((i as unknown as { invoice_items: { cost_of_goods_sold: number | null }[] }).invoice_items ?? []).reduce(
        (a, b) => a + (b.cost_of_goods_sold ?? 0),
        0
      ),
    0
  )
  const grossProfit = totalSales - cogs
  const itemsSold = rows.reduce(
    (s, i) =>
      s +
      ((i as unknown as { invoice_items: { quantity: number }[] }).invoice_items ?? []).reduce(
        (a, b) => a + b.quantity,
        0
      ),
    0
  )
  const uniqueCustomers = new Set(rows.map((i) => i.customer_phone).filter(Boolean)).size

  const sumByMethod = (method: string) =>
    (payments ?? []).filter((p) => p.payment_method === method).reduce((s, p) => s + p.amount, 0)

  const cashReceived = sumByMethod('cash')
  const openingCash = outlet?.opening_cash ?? 0
  const closingCash = openingCash + cashReceived

  const alerts: { type: string; severity: string; message: string }[] = []
  for (const item of lowStock ?? []) {
    alerts.push({ type: 'low_stock', severity: 'warning', message: `Stok ${item.name} menipis` })
  }

  return NextResponse.json({
    date: today,
    sales: {
      total_sales: totalSales,
      cash: cashReceived,
      e_wallet: sumByMethod('e_wallet'),
      bank_transfer: sumByMethod('bank_transfer'),
      total_discount: totalDiscount,
      tax_collected: taxCollected,
    },
    inventory: {
      cost_of_goods_sold: cogs,
      gross_profit: grossProfit,
      gross_profit_margin: totalSales ? Math.round((grossProfit / totalSales) * 10000) / 100 : 0,
    },
    cash_position: {
      opening_cash: openingCash,
      cash_received: cashReceived,
      cash_paid_out: 0,
      closing_cash: closingCash,
      expected_closing: closingCash,
      variance: 0,
    },
    operations: {
      transaction_count: rows.length,
      items_sold: itemsSold,
      unique_customers: uniqueCustomers,
      avg_transaction_value: rows.length ? totalSales / rows.length : 0,
    },
    alerts,
  })
}
