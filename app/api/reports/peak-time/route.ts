import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jumat", 'Sabtu']

// GET /api/reports/peak-time?outlet_id=&type=sales|product&days=30&start=&end=
// — hour-of-day and day-of-week aggregation, so staffing/restocking can
// match demand. start/end (YYYY-MM-DD) override `days` when both are given.
// Hour/day-of-week are read via getUTC*() and the query boundary via
// resolveDateRange()'s UTC-safe strings — both invoices.created_at storage
// and every other date boundary in this app are UTC, so bucketing in UTC
// keeps this internally consistent (see todo.md Phase 27/28 for the local-
// timezone version of this bug: it silently reshuffled every row into the
// wrong hour/day bucket by the full server-local UTC offset).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') === 'product' ? 'product' : 'sales'
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const { startIso, endIso } = resolveDateRange(searchParams, 30, 180)

  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, count: 0 }))
  const daily = DAY_LABELS.map((label, day) => ({ day, label, total: 0, count: 0 }))

  if (type === 'sales') {
    const { data, error } = await auth.supabase
      .from('invoices')
      .select('created_at, total')
      .in('outlet_id', outletIds)
      .neq('order_status', 'voided')
      .gte('created_at', startIso)
      .lte('created_at', endIso)

    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    for (const inv of data ?? []) {
      const d = new Date(inv.created_at)
      hourly[d.getUTCHours()].total += inv.total
      hourly[d.getUTCHours()].count += 1
      daily[d.getUTCDay()].total += inv.total
      daily[d.getUTCDay()].count += 1
    }
  } else {
    const { data, error } = await auth.supabase
      .from('invoice_items')
      .select('quantity, invoices!inner(created_at, outlet_id, order_status)')
      .in('invoices.outlet_id', outletIds)
      .neq('invoices.order_status', 'voided')
      .gte('invoices.created_at', startIso)
      .lte('invoices.created_at', endIso)

    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    type ItemRow = { quantity: number; invoices: { created_at: string } | { created_at: string }[] }
    for (const row of (data ?? []) as unknown as ItemRow[]) {
      const inv = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices
      if (!inv) continue
      const d = new Date(inv.created_at)
      hourly[d.getUTCHours()].total += row.quantity
      hourly[d.getUTCHours()].count += 1
      daily[d.getUTCDay()].total += row.quantity
      daily[d.getUTCDay()].count += 1
    }
  }

  return NextResponse.json({ hourly, daily })
}
