import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, closeCashierShiftSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/cashier-shifts/:id/close — computes total cash settled since
// shift_start_time (via payment_transactions -> invoices, same join pattern
// as /api/reports/cash-position), sets closing_cash, and marks reconciled.
// The generated cash_variance/expected_closing_cash columns recompute
// automatically from the values written here.
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

  const { data: cashPayments } = await auth.supabase
    .from('payment_transactions')
    .select('amount, invoices!inner(outlet_id, created_at)')
    .eq('invoices.outlet_id', shift.outlet_id)
    .eq('payment_method', 'cash')
    .eq('status', 'settled')
    .gte('invoices.created_at', shift.shift_start_time ?? shift.created_at)

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

  return NextResponse.json({ shift: data })
}
