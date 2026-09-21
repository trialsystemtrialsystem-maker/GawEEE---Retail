import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

type Row = { payment_method: string; amount: number; settlement_date: string | null; status: string; invoices: { outlet_id: string } | { outlet_id: string }[] }

// GET /api/reports/settlement-report?outlet_id=&days=30&start=&end= —
// payment settlements grouped by date, for reconciling what actually
// cleared vs. is still pending/unsettled.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const { startIso, endIso } = resolveDateRange(searchParams, 30, 180)

  const { data, error } = await auth.supabase
    .from('payment_transactions')
    .select('payment_method, amount, settlement_date, status, invoices!inner(outlet_id)')
    .in('invoices.outlet_id', outletIds)
    .gte('created_at', startIso)
    .lte('created_at', endIso)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const byDate = new Map<string, { date: string; settled: number; pending: number }>()
  let unsettledTotal = 0
  for (const row of (data ?? []) as unknown as Row[]) {
    if (row.status === 'settled' && row.settlement_date) {
      const key = row.settlement_date.slice(0, 10)
      const bucket = byDate.get(key) ?? { date: key, settled: 0, pending: 0 }
      bucket.settled += row.amount
      byDate.set(key, bucket)
    } else if (row.status === 'pending' || row.status === 'processing') {
      unsettledTotal += row.amount
    }
  }

  return NextResponse.json({
    rows: Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date)),
    unsettledTotal,
  })
}
