import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/void-analysis?start=&end=&outlet_id= — voided-sale (cancellation) loss-
// prevention report, standard in enterprise POS/retail systems (a high or
// spiking void rate — especially concentrated on one cashier — is one of
// the most common employee-fraud/error signals, e.g. "sweethearting":
// ringing a sale then voiding it after the customer leaves with the goods).
// Groups by the ORIGINAL cashier who rang the sale (invoices.cashier_id),
// not who approved the void (void_invoice() requires manager+, so that's
// always a manager and not the interesting signal here).
type InvoiceRow = { id: string; total: number; created_at: string; voided_at: string | null; void_reason: string | null; cashier_id: string; order_status: string }

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope
  const { startIso, endIso } = resolveDateRange(searchParams, 30, 365)

  const [invoicesRes, usersRes] = await Promise.all([
    auth.supabase
      .from('invoices')
      .select('id, total, created_at, voided_at, void_reason, cashier_id, order_status')
      .in('outlet_id', outletIds)
      .gte('created_at', startIso)
      .lte('created_at', endIso),
    auth.supabase.from('users').select('id, full_name'),
  ])

  if (invoicesRes.error) {
    const { status, message } = handleDatabaseError(invoicesRes.error)
    return NextResponse.json({ error: message }, { status })
  }

  const nameById = new Map((usersRes.data ?? []).map((u) => [u.id, u.full_name]))
  const rows = invoicesRes.data as unknown as InvoiceRow[]
  const voided = rows.filter((r) => r.order_status === 'voided')

  const totalCount = rows.length
  const voidedCount = voided.length
  const voidedValue = voided.reduce((s, r) => s + r.total, 0)

  const byCashierMap = new Map<string, { cashier_id: string; cashier_name: string; total_sales: number; voided_count: number; voided_value: number }>()
  for (const r of rows) {
    const entry = byCashierMap.get(r.cashier_id) ?? { cashier_id: r.cashier_id, cashier_name: nameById.get(r.cashier_id) ?? 'Tidak diketahui', total_sales: 0, voided_count: 0, voided_value: 0 }
    entry.total_sales += 1
    if (r.order_status === 'voided') {
      entry.voided_count += 1
      entry.voided_value += r.total
    }
    byCashierMap.set(r.cashier_id, entry)
  }
  const byCashier = Array.from(byCashierMap.values())
    .filter((c) => c.voided_count > 0)
    .map((c) => ({ ...c, void_rate_pct: c.total_sales > 0 ? (c.voided_count / c.total_sales) * 100 : 0 }))
    .sort((a, b) => b.void_rate_pct - a.void_rate_pct)

  const reasonMap = new Map<string, number>()
  for (const r of voided) {
    const reason = r.void_reason?.trim() || '(tanpa alasan)'
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1)
  }
  const byReason = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const byDayMap = new Map<string, number>()
  for (const r of voided) {
    if (!r.voided_at) continue
    const day = r.voided_at.slice(0, 10)
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1)
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))

  return NextResponse.json({
    summary: {
      total_invoices: totalCount,
      voided_count: voidedCount,
      voided_value: voidedValue,
      void_rate_pct: totalCount > 0 ? (voidedCount / totalCount) * 100 : 0,
    },
    byCashier,
    byReason,
    byDay,
  })
}
