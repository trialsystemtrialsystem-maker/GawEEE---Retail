import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate, cashAdvanceActionSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { isFullyRepaid } from '@/lib/utils/cashAdvance'

// PATCH /api/cash-advances/:id { action: approve|reject|payout|repay } —
// gated by the same permission as payroll (payroll.manage): whoever can run
// payroll can decide and pay out kasbon. Lifecycle: pending -> approved ->
// paid_out (money handed over; only now is it a debt) -> repaid, either via
// payroll deductions or manual repayments recorded here.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/cash-advances/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const result = validate(cashAdvanceActionSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const body = result.data

  const { data: advance } = await auth.supabase.from('cash_advances').select('*').eq('id', id).single()
  if (!advance) return NextResponse.json({ error: 'Kasbon tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, advance.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const now = new Date().toISOString()
  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  if (body.action === 'approve' || body.action === 'reject') {
    if (advance.status !== 'pending') return NextResponse.json({ error: 'Hanya kasbon berstatus menunggu yang dapat diputuskan' }, { status: 409 })
    const { error } = await auth.supabase
      .from('cash_advances')
      .update({ status: body.action === 'approve' ? 'approved' : 'rejected', decided_by: auth.id, decided_at: now })
      .eq('id', id)
    return error ? fail(error) : NextResponse.json({ ok: true })
  }

  if (body.action === 'payout') {
    if (advance.status !== 'approved') return NextResponse.json({ error: 'Kasbon harus disetujui sebelum dicairkan' }, { status: 409 })
    const { error } = await auth.supabase.from('cash_advances').update({ status: 'paid_out', paid_out_at: now }).eq('id', id)
    return error ? fail(error) : NextResponse.json({ ok: true })
  }

  // repay (manual)
  if (advance.status !== 'paid_out') return NextResponse.json({ error: 'Hanya kasbon yang sudah dicairkan yang dapat dicicil' }, { status: 409 })
  const { data: reps } = await auth.supabase.from('cash_advance_repayments').select('amount').eq('advance_id', id)
  const repaid = (reps ?? []).reduce((s, r) => s + r.amount, 0)
  if (body.amount > advance.amount - repaid + 0.005) return NextResponse.json({ error: 'Nominal melebihi sisa kasbon' }, { status: 400 })

  const { error: repError } = await auth.supabase
    .from('cash_advance_repayments')
    .insert({ advance_id: id, amount: body.amount, method: 'manual', note: body.note ?? null, created_by: auth.id })
  if (repError) return fail(repError)
  if (isFullyRepaid(advance.amount, repaid + body.amount)) await auth.supabase.from('cash_advances').update({ status: 'repaid' }).eq('id', id)
  return NextResponse.json({ ok: true })
}
