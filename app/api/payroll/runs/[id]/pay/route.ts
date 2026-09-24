import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { handleDatabaseError } from '@/lib/utils/errors'
import { isFullyRepaid } from '@/lib/utils/cashAdvance'

// POST /api/payroll/runs/:id/pay — manager+ only, marks a draft run as paid.
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/payroll/runs/[id]/pay'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase
    .from('payroll_runs')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  // Kasbon instalments planned on the slips become real repayments only now
  // that the salary is actually paid. Capped at the remaining balance so two
  // overlapping drafts can never over-collect.
  const { data: kasbonItems } = await auth.supabase
    .from('payslip_items')
    .select('payslip_id, amount, basis, payslips!inner(payroll_run_id)')
    .eq('kind', 'kasbon')
    .eq('payslips.payroll_run_id', id)
  for (const item of (kasbonItems ?? []) as unknown as { payslip_id: string; amount: number; basis: { advance_id?: string } }[]) {
    const advanceId = item.basis?.advance_id
    if (!advanceId) continue
    const { data: adv } = await auth.supabase.from('cash_advances').select('amount, status').eq('id', advanceId).single()
    if (!adv || adv.status !== 'paid_out') continue
    const { data: reps } = await auth.supabase.from('cash_advance_repayments').select('amount').eq('advance_id', advanceId)
    const repaid = (reps ?? []).reduce((sum, r) => sum + r.amount, 0)
    const amount = Math.min(item.amount, Math.max(0, adv.amount - repaid))
    if (amount <= 0) continue
    await auth.supabase
      .from('cash_advance_repayments')
      .insert({ advance_id: advanceId, payslip_id: item.payslip_id, amount, method: 'payroll', note: 'Potongan gaji', created_by: auth.id })
    if (isFullyRepaid(adv.amount, repaid + amount)) await auth.supabase.from('cash_advances').update({ status: 'repaid' }).eq('id', advanceId)
  }

  return NextResponse.json({ run: data })
}
