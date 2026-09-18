import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, closeCashierShiftSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/cashier-shifts/:id/close — computes total cash settled during
// this shift, sets closing_cash, and marks reconciled. The generated
// cash_variance/expected_closing_cash columns recompute automatically from
// the values written here.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/cashier-shifts/[id]/close'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const result = validate(closeCashierShiftSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: shift } = await auth.supabase.from('cashier_shifts').select('*').eq('id', id).single()
  if (!shift) return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })
  if (shift.status !== 'open') return NextResponse.json({ error: 'Shift ini sudah ditutup' }, { status: 400 })

  // invoices.cashier_shift_id (062_sales_identification.sql) is stamped at
  // checkout time on whatever shift is currently open for the outlet — an
  // exact join instead of the created_at >= shift_start_time range query
  // this used before, which only ever worked by relying on there being just
  // one open shift per outlet at a time (still true today, but this doesn't
  // need to lean on that assumption anymore).
  const { data: cashPayments } = await auth.supabase
    .from('payment_transactions')
    .select('amount, invoices!inner(cashier_shift_id)')
    .eq('invoices.cashier_shift_id', id)
    .eq('payment_method', 'cash')
    .eq('status', 'settled')

  const totalCash = (cashPayments ?? []).reduce((s, p) => s + p.amount, 0)

  const { data, error } = await auth.supabase
    .from('cashier_shifts')
    .update({
      closing_cash: result.data.closing_cash,
      total_transactions: totalCash,
      status: 'closed',
      shift_end_time: new Date().toISOString(),
      reconciled: true,
      reconciled_by: auth.id,
      reconciliation_notes: result.data.reconciliation_notes,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  // system_alerts (006_hr_ops.sql) was defined with 'cash_variance' as one
  // of its documented alert_type values but nothing ever actually inserted
  // one — GET /api/notifications already reads and renders unresolved
  // alerts generically, this was just missing the write side. Additive
  // follow-up, same non-blocking trade-off as everywhere else in this file:
  // a failed alert insert should never stop a shift from closing.
  const variance = data.cash_variance ?? 0
  if (Math.abs(variance) >= 10000) {
    await auth.supabase.from('system_alerts').insert({
      outlet_id: shift.outlet_id,
      alert_type: 'cash_variance',
      severity: Math.abs(variance) >= 50000 ? 'critical' : 'warning',
      title: `Selisih kas ${variance > 0 ? 'lebih' : 'kurang'} Rp${Math.abs(variance).toLocaleString('id-ID')}`,
      description: `Shift ditutup dengan kas fisik Rp${result.data.closing_cash.toLocaleString('id-ID')} vs. perkiraan Rp${(data.expected_closing_cash ?? 0).toLocaleString('id-ID')}.`,
      reference_entity_type: 'cashier_shift',
      reference_entity_id: id,
    })
  }

  return NextResponse.json({ shift: data })
}
