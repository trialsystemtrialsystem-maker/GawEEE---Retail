import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate, generatePayrollRunSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { composePayslip, type AdvanceInstallment } from '@/lib/utils/payslipItems'
import { nextInstallment } from '@/lib/utils/cashAdvance'

// GET /api/payroll/runs?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('payroll_runs')
    .select('*')
    .eq('outlet_id', outletId)
    .order('period_start', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ runs: data })
}

// POST /api/payroll/runs — manager+ only. Generates a draft run with one
// payslip per active staff member: base salary from staff_members, plus
// commission computed from that staff's cashier sales in the period
// (matched by email, same approach as the Sales Dashboard's commission
// report — there's no direct FK between users and staff_members).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(generatePayrollRunSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { outlet_id, period_start, period_end } = result.data

  const { data: staff, error: staffError } = await auth.supabase
    .from('staff_members')
    .select('id, salary_amount, commission_rate, email')
    .eq('outlet_id', outlet_id)
    .eq('status', 'active')
    .is('deleted_at', null)

  if (staffError) {
    const { status, message } = handleDatabaseError(staffError)
    return NextResponse.json({ error: message }, { status })
  }
  if (!staff || staff.length === 0) {
    return NextResponse.json({ error: 'Tidak ada karyawan aktif' }, { status: 400 })
  }

  const [usersRes, invoicesRes] = await Promise.all([
    auth.supabase.from('users').select('id, email').eq('company_id', auth.company_id),
    auth.supabase
      .from('invoices')
      .select('cashier_id, total')
      .eq('outlet_id', outlet_id)
      .neq('order_status', 'voided')
      .gte('created_at', `${period_start}T00:00:00`)
      .lte('created_at', `${period_end}T23:59:59`),
  ])

  const emailByUserId = new Map((usersRes.data ?? []).map((u) => [u.id, u.email]))
  const salesByEmail = new Map<string, number>()
  for (const inv of invoicesRes.data ?? []) {
    const email = emailByUserId.get(inv.cashier_id)
    if (!email) continue
    salesByEmail.set(email, (salesByEmail.get(email) ?? 0) + inv.total)
  }

  const { data: run, error: runError } = await auth.supabase
    .from('payroll_runs')
    .insert({ outlet_id, period_start, period_end, created_by: auth.id })
    .select()
    .single()

  if (runError) {
    const { status, message } = handleDatabaseError(runError)
    return NextResponse.json({ error: message }, { status })
  }

  // Daily incentives inside the period and outstanding kasbon per staff.
  const [incRes, advRes] = await Promise.all([
    auth.supabase
      .from('daily_incentives')
      .select('staff_id, rule_name, amount')
      .eq('outlet_id', outlet_id)
      .gte('incentive_date', period_start)
      .lte('incentive_date', period_end),
    auth.supabase
      .from('cash_advances')
      .select('id, staff_id, amount, status, repay_per_period, advance_date')
      .eq('outlet_id', outlet_id)
      .eq('status', 'paid_out'),
  ])
  const advIds = (advRes.data ?? []).map((a) => a.id)
  const repaidByAdvance = new Map<string, number>()
  if (advIds.length > 0) {
    const { data: reps } = await auth.supabase.from('cash_advance_repayments').select('advance_id, amount').in('advance_id', advIds)
    for (const r of reps ?? []) repaidByAdvance.set(r.advance_id, (repaidByAdvance.get(r.advance_id) ?? 0) + r.amount)
  }

  const composed = staff.map((s) => {
    const sales = (s.email ? salesByEmail.get(s.email) : undefined) ?? 0
    const installments: AdvanceInstallment[] = (advRes.data ?? [])
      .filter((a) => a.staff_id === s.id)
      .map((a) => ({ advance_id: a.id, advance_date: a.advance_date, amount: nextInstallment(a, repaidByAdvance.get(a.id) ?? 0) }))
    return {
      staff_id: s.id,
      comp: composePayslip({
        base_salary: s.salary_amount ?? 0,
        sales,
        commission_rate: Number(s.commission_rate),
        incentives: (incRes.data ?? []).filter((i) => i.staff_id === s.id),
        installments,
      }),
    }
  })

  const { data: slips, error: payslipError } = await auth.supabase
    .from('payslips')
    .insert(
      composed.map((c) => ({
        payroll_run_id: run.id,
        staff_id: c.staff_id,
        base_salary: c.comp.base_salary,
        commission_amount: c.comp.commission_amount,
        deductions: c.comp.deductions,
      }))
    )
    .select('id, staff_id')
  if (payslipError) {
    const { status, message } = handleDatabaseError(payslipError)
    return NextResponse.json({ error: message }, { status })
  }

  // Itemized breakdown (migration 064). Best-effort: the payslip totals above
  // are already authoritative, so a missing table must not fail the run.
  const slipByStaff = new Map((slips ?? []).map((sl) => [sl.staff_id, sl.id]))
  const itemRows = composed.flatMap((c) =>
    c.comp.items.map((i) => ({ payslip_id: slipByStaff.get(c.staff_id) as string, kind: i.kind, label: i.label, amount: i.amount, basis: i.basis }))
  )
  if (itemRows.length > 0) await auth.supabase.from('payslip_items').insert(itemRows)

  return NextResponse.json({ payroll_run_id: run.id }, { status: 201 })
}
