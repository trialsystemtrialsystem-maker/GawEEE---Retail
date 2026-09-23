import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'

// GET /api/reports/p-and-l?from_date&to_date&outlet_id= — see prd.md §4.6.
// outlet_id is optional (defaults to the caller's own outlet) so a
// master_admin — whose own outlet_id is null — can still pick one; this
// mirrors every other accounting-family route's canAccessOutlet() pattern,
// not resolveOutletScope()'s 'all' aggregation.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const fromDate = searchParams.get('from_date') ?? new Date().toISOString().slice(0, 10)
  const toDate = searchParams.get('to_date') ?? new Date().toISOString().slice(0, 10)

  const { data: invoices } = await auth.supabase
    .from('invoices')
    .select('total, invoice_items(cost_of_goods_sold)')
    .eq('outlet_id', outletId)
    .neq('order_status', 'voided')
    .gte('created_at', `${fromDate}T00:00:00`)
    .lte('created_at', `${toDate}T23:59:59`)

  const rows = invoices ?? []
  const revenue = rows.reduce((s, i) => s + i.total, 0)
  const cogs = rows.reduce(
    (s, i) =>
      s +
      ((i as unknown as { invoice_items: { cost_of_goods_sold: number | null }[] }).invoice_items ?? []).reduce(
        (a, b) => a + (b.cost_of_goods_sold ?? 0),
        0
      ),
    0
  )
  const grossProfit = revenue - cogs
  // Operating expenses aren't tracked yet (todo.md Phase 1 "Nice-to-Have":
  // basic expense tracking) — reported as 0 until that module exists.
  const operatingExpenses = { salaries: 0, rent: 0, utilities: 0, other: 0, total: 0 }
  const operatingProfit = grossProfit - operatingExpenses.total
  const netProfit = operatingProfit

  return NextResponse.json({
    period: { from_date: fromDate, to_date: toDate },
    revenue,
    cost_of_goods_sold: cogs,
    gross_profit: grossProfit,
    gross_profit_margin: revenue ? Math.round((grossProfit / revenue) * 10000) / 100 : 0,
    operating_expenses: operatingExpenses,
    operating_profit: operatingProfit,
    other_income_expenses: 0,
    net_profit: netProfit,
    net_profit_margin: revenue ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
  })
}
