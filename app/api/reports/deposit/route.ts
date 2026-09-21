import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/deposit?outlet_id=&start=&end= — status breakdown +
// totals for the Deposit Report.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const { startIso, endIso } = resolveDateRange(searchParams, 36500, 36500) // lifetime by default, narrowed when start/end given

  const { data, error } = await auth.supabase
    .from('product_deposits')
    .select('id, customer_name, quantity, deposit_amount, total_price, status, created_at, products(name)')
    .in('outlet_id', outletIds)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const deposits = data ?? []
  const byStatus = { pending: 0, fulfilled: 0, cancelled: 0 } as Record<'pending' | 'fulfilled' | 'cancelled', number>
  let totalDeposited = 0
  let totalOutstanding = 0
  for (const d of deposits) {
    byStatus[d.status as 'pending' | 'fulfilled' | 'cancelled'] += 1
    if (d.status !== 'cancelled') totalDeposited += d.deposit_amount
    if (d.status === 'pending') totalOutstanding += d.total_price - d.deposit_amount
  }

  return NextResponse.json({
    deposits,
    summary: { byStatus, totalDeposited, totalOutstanding },
  })
}
