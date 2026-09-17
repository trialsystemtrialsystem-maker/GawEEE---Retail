import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/admin/outlets/daily?days=14 — master_admin only. Day-by-day
// revenue/transaction-count for every one of the company's outlets, plus a
// company-wide combined total — the "Rincian Harian" (daily breakdown) view
// on the multi-outlet monitoring dashboard, so a specific day's sales can be
// compared outlet-by-outlet instead of only seeing a single month-to-date
// number per outlet.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days') ?? '14'), 1), 60)
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)

  const { data: outlets } = await auth.supabase.from('outlets').select('id, name').eq('company_id', auth.company_id)

  const { data: invoices, error } = await auth.supabase
    .from('invoices')
    .select('outlet_id, created_at, total')
    .in('outlet_id', (outlets ?? []).map((o) => o.id))
    .neq('order_status', 'voided')
    .gte('created_at', start.toISOString())

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  function emptyDays() {
    return dates.map((date) => ({ date, revenue: 0, transaction_count: 0 }))
  }

  const combinedByDate = new Map(emptyDays().map((d) => [d.date, d]))
  const perOutlet = new Map((outlets ?? []).map((o) => [o.id, { outlet_id: o.id, outlet_name: o.name, daily: emptyDays() }]))
  const perOutletByDate = new Map(
    Array.from(perOutlet.values()).map((o) => [o.outlet_id, new Map(o.daily.map((d) => [d.date, d]))])
  )

  for (const inv of invoices ?? []) {
    const date = inv.created_at.slice(0, 10)
    const combinedBucket = combinedByDate.get(date)
    if (combinedBucket) {
      combinedBucket.revenue += inv.total
      combinedBucket.transaction_count += 1
    }
    const outletBucket = perOutletByDate.get(inv.outlet_id)?.get(date)
    if (outletBucket) {
      outletBucket.revenue += inv.total
      outletBucket.transaction_count += 1
    }
  }

  return NextResponse.json({
    days,
    dates,
    combined: Array.from(combinedByDate.values()),
    outlets: Array.from(perOutlet.values()),
  })
}
