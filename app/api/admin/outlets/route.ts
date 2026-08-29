import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/admin/outlets — master_admin only. See prd.md §4.7.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: outlets } = await auth.supabase
    .from('outlets')
    .select('id, name, status')
    .eq('company_id', auth.company_id)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const results = await Promise.all(
    (outlets ?? []).map(async (outlet) => {
      const { data: invoices } = await auth.supabase
        .from('invoices')
        .select('total, created_at, invoice_items(cost_of_goods_sold)')
        .eq('outlet_id', outlet.id)
        .neq('order_status', 'voided')
        .gte('created_at', startOfMonth.toISOString())

      const { count: staffCount } = await auth.supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('outlet_id', outlet.id)

      const rows = invoices ?? []
      const revenueMtd = rows.reduce((s, i) => s + i.total, 0)
      const cogs = rows.reduce(
        (s, i) =>
          s +
          ((i as unknown as { invoice_items: { cost_of_goods_sold: number | null }[] }).invoice_items ?? []).reduce(
            (a, b) => a + (b.cost_of_goods_sold ?? 0),
            0
          ),
        0
      )
      const profitMargin = revenueMtd ? ((revenueMtd - cogs) / revenueMtd) * 100 : 0
      const lastTransaction = rows.length
        ? rows.reduce((latest, i) => (i.created_at > latest ? i.created_at : latest), rows[0].created_at)
        : null

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        revenue_mtd: revenueMtd,
        revenue_change_percent: null,
        profit_margin_percent: Math.round(profitMargin * 100) / 100,
        transaction_count: rows.length,
        last_transaction: lastTransaction,
        staff_count: staffCount ?? 0,
        status: outlet.status,
        alerts: [],
      }
    })
  )

  const totalRevenue = results.reduce((s, r) => s + r.revenue_mtd, 0)
  const totalTransactions = results.reduce((s, r) => s + r.transaction_count, 0)
  const totalStaff = results.reduce((s, r) => s + r.staff_count, 0)

  return NextResponse.json({
    total_outlets: results.length,
    active_outlets: results.filter((r) => r.status === 'active').length,
    suspended_outlets: results.filter((r) => r.status !== 'active').length,
    outlets: results,
    company_totals: {
      total_revenue_mtd: totalRevenue,
      total_profit_margin:
        results.length && totalRevenue
          ? Math.round((results.reduce((s, r) => s + r.profit_margin_percent, 0) / results.length) * 100) / 100
          : 0,
      total_transactions: totalTransactions,
      total_staff: totalStaff,
      avg_outlet_revenue: results.length ? totalRevenue / results.length : 0,
    },
  })
}
