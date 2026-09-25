import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { selectAll } from '@/lib/utils/fetchAll'

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

  const { startIso, endIso, startDate, endDate } = resolveDateRange(request.nextUrl.searchParams, 14, 60)

  const { data: outlets } = await auth.supabase.from('outlets').select('id, name').eq('company_id', auth.company_id)

  const { data: invoices, error } = await selectAll(auth.supabase
    .from('invoices')
    .select('outlet_id, created_at, total')
    .in('outlet_id', (outlets ?? []).map((o) => o.id))
    .neq('order_status', 'voided')
    .gte('created_at', startIso)
    .lte('created_at', endIso))

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00.000Z`)
  const endCursor = new Date(`${endDate}T00:00:00.000Z`)
  while (cursor <= endCursor) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

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
    start: startDate,
    end: endDate,
    dates,
    combined: Array.from(combinedByDate.values()),
    outlets: Array.from(perOutlet.values()),
  })
}
