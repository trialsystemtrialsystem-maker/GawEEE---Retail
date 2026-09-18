import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

const BACKFILL_DAYS = 7

/** Same live-computation logic as GET /api/reports/daily-summary, just for
 * an arbitrary already-completed date instead of always "today". */
async function computeSummary(auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>, outletId: string, date: string) {
  const startOfDay = `${date}T00:00:00`
  const endOfDay = `${date}T23:59:59`

  const [{ data: invoices }, { data: payments }, { data: outlet }] = await Promise.all([
    auth.supabase
      .from('invoices')
      .select('*, invoice_items(quantity, cost_of_goods_sold)')
      .eq('outlet_id', outletId)
      .neq('order_status', 'voided')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    auth.supabase
      .from('payment_transactions')
      .select('payment_method, amount, invoices!inner(outlet_id)')
      .eq('invoices.outlet_id', outletId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),
    auth.supabase.from('outlets').select('opening_cash').eq('id', outletId).single(),
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
      ((i as unknown as { invoice_items: { quantity: number }[] }).invoice_items ?? []).reduce((a, b) => a + b.quantity, 0),
    0
  )
  const uniqueCustomers = new Set(rows.map((i) => i.customer_phone).filter(Boolean)).size
  const sumByMethod = (method: string) => (payments ?? []).filter((p) => p.payment_method === method).reduce((s, p) => s + p.amount, 0)
  const cashReceived = sumByMethod('cash')
  const openingCash = outlet?.opening_cash ?? 0
  const closingCash = openingCash + cashReceived

  return {
    outlet_id: outletId,
    summary_date: date,
    total_sales: totalSales,
    total_discount: totalDiscount,
    total_tax_collected: taxCollected,
    total_cash_received: cashReceived,
    total_e_wallet_received: sumByMethod('e_wallet'),
    total_bank_transfer_pending: sumByMethod('bank_transfer'),
    total_invoices: rows.length,
    total_items_sold: itemsSold,
    unique_customers: uniqueCustomers,
    cash_on_hand_opening: openingCash,
    cash_on_hand_closing: closingCash,
    cash_variance: 0,
    cost_of_goods_sold: cogs,
    gross_profit: grossProfit,
    gross_profit_margin: totalSales ? Math.round((grossProfit / totalSales) * 10000) / 100 : 0,
  }
}

// POST /api/reports/daily-summary/backfill — no real nightly job exists in
// this app (documented, out-of-scope trade-off), so daily_financial_summary
// has sat completely empty since the table was created. Same check-on-
// page-load pattern as Price Scheduler: called once when the financial
// dashboard mounts, it fills in any of the last 7 days that (a) are fully
// in the past (today's numbers are still live/changing, so not archived
// yet) and (b) don't already have a row, from the same computation
// GET /api/reports/daily-summary already does live for "today".
export async function POST() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const today = new Date()
  const dates: string[] = []
  for (let i = 1; i <= BACKFILL_DAYS; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  const { data: existing } = await auth.supabase
    .from('daily_financial_summary')
    .select('summary_date')
    .eq('outlet_id', auth.outlet_id)
    .in('summary_date', dates)
  const existingDates = new Set((existing ?? []).map((r) => r.summary_date))
  const missingDates = dates.filter((d) => !existingDates.has(d))

  let filled = 0
  for (const date of missingDates) {
    const summary = await computeSummary(auth, auth.outlet_id, date)
    // Only worth writing a row for a day that actually had activity —
    // skip an all-zero row for a day before the outlet existed/had sales.
    if (summary.total_invoices === 0) continue
    const { error } = await auth.supabase.from('daily_financial_summary').insert(summary)
    if (!error) filled++
  }

  return NextResponse.json({ filled_count: filled })
}
