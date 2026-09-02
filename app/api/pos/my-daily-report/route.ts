import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/pos/my-daily-report?date=YYYY-MM-DD — cashier-scoped version of
// the existing outlet-wide /api/invoices/daily-summary. Deliberately a
// separate route rather than adding a filter to that one, so the
// manager-facing report keeps zero risk from this change (Phase 12 plan).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 400 })

  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  const { data: invoices, error } = await auth.supabase
    .from('invoices')
    .select('id, total, order_status, created_at')
    .eq('outlet_id', auth.outlet_id)
    .eq('cashier_id', auth.authUserId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const activeInvoices = (invoices ?? []).filter((i) => i.order_status !== 'voided')
  const voidedCount = (invoices ?? []).length - activeInvoices.length
  const totalSales = activeInvoices.reduce((sum, i) => sum + i.total, 0)
  const transactionCount = activeInvoices.length

  const hourBuckets = new Map<number, number>()
  for (const inv of activeInvoices) {
    const hour = new Date(inv.created_at).getHours()
    hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + inv.total)
  }
  const salesByHour = Array.from(hourBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, total]) => ({ hour: `${String(hour).padStart(2, '0')}:00`, total }))

  const invoiceIds = activeInvoices.map((i) => i.id)
  let paymentBreakdown: { method: string; total: number }[] = []
  if (invoiceIds.length > 0) {
    const { data: payments } = await auth.supabase
      .from('payment_transactions')
      .select('payment_method, amount')
      .in('invoice_id', invoiceIds)
      .eq('status', 'settled')

    const byMethod = new Map<string, number>()
    for (const p of payments ?? []) {
      byMethod.set(p.payment_method, (byMethod.get(p.payment_method) ?? 0) + p.amount)
    }
    paymentBreakdown = Array.from(byMethod.entries()).map(([method, total]) => ({ method, total }))
  }

  return NextResponse.json({
    date,
    total_sales: totalSales,
    transaction_count: transactionCount,
    avg_transaction: transactionCount ? totalSales / transactionCount : 0,
    voided_count: voidedCount,
    sales_by_hour: salesByHour,
    payment_breakdown: paymentBreakdown,
  })
}
