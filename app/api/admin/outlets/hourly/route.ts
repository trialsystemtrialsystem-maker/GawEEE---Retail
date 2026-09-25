import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/admin/outlets/hourly?days=7 — master_admin only. Hour-of-day
// revenue/transaction breakdown for every one of the company's outlets, plus
// a company-wide combined total — the "Hourly" view on the multi-outlet
// monitoring dashboard (/dashboard/admin/outlets), complementing its
// existing month-to-date summary. Same hour-of-day aggregation as
// /api/reports/peak-time, but across ALL outlets at once instead of one.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { startIso, endIso, startDate, endDate } = resolveDateRange(request.nextUrl.searchParams, 7, 90)

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

  function emptyHours() {
    return Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, transaction_count: 0 }))
  }

  const combined = emptyHours()
  const perOutlet = new Map((outlets ?? []).map((o) => [o.id, { outlet_id: o.id, outlet_name: o.name, hourly: emptyHours() }]))

  for (const inv of invoices ?? []) {
    const hour = new Date(inv.created_at).getUTCHours()
    combined[hour].revenue += inv.total
    combined[hour].transaction_count += 1
    const bucket = perOutlet.get(inv.outlet_id)
    if (bucket) {
      bucket.hourly[hour].revenue += inv.total
      bucket.hourly[hour].transaction_count += 1
    }
  }

  return NextResponse.json({
    start: startDate,
    end: endDate,
    combined,
    outlets: Array.from(perOutlet.values()),
  })
}
