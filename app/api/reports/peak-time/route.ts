import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jumat", 'Sabtu']

// GET /api/reports/peak-time?outlet_id=&type=sales|product&days=30 — hour-of-
// day and day-of-week aggregation, so staffing/restocking can match demand.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const type = searchParams.get('type') === 'product' ? 'product' : 'sales'
  const days = Math.min(Number(searchParams.get('days') ?? '30'), 180)
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)

  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, count: 0 }))
  const daily = DAY_LABELS.map((label, day) => ({ day, label, total: 0, count: 0 }))

  if (type === 'sales') {
    const { data, error } = await auth.supabase
      .from('invoices')
      .select('created_at, total')
      .eq('outlet_id', outletId)
      .neq('order_status', 'voided')
      .gte('created_at', start.toISOString())

    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    for (const inv of data ?? []) {
      const d = new Date(inv.created_at)
      hourly[d.getHours()].total += inv.total
      hourly[d.getHours()].count += 1
      daily[d.getDay()].total += inv.total
      daily[d.getDay()].count += 1
    }
  } else {
    const { data, error } = await auth.supabase
      .from('invoice_items')
      .select('quantity, invoices!inner(created_at, outlet_id, order_status)')
      .eq('invoices.outlet_id', outletId)
      .neq('invoices.order_status', 'voided')
      .gte('invoices.created_at', start.toISOString())

    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    type ItemRow = { quantity: number; invoices: { created_at: string } | { created_at: string }[] }
    for (const row of (data ?? []) as unknown as ItemRow[]) {
      const inv = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices
      if (!inv) continue
      const d = new Date(inv.created_at)
      hourly[d.getHours()].total += row.quantity
      hourly[d.getHours()].count += 1
      daily[d.getDay()].total += row.quantity
      daily[d.getDay()].count += 1
    }
  }

  return NextResponse.json({ hourly, daily })
}
