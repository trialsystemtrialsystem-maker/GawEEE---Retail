import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { handleDatabaseError } from '@/lib/utils/errors'
import { leaveDaysWithin, lateMinutes } from '@/lib/utils/employeeHistory'
import { outstandingBalance } from '@/lib/utils/cashAdvance'

// GET /api/staff/reports?outlet_id=&start=&end= — one row per employee for the
// period (todo.md Phase 33 batch F): attendance, lateness, leave by type,
// daily incentives, outstanding kasbon and net pay actually paid. Managers
// only — it exposes pay. Same source tables and rules as the per-employee
// history route so the two never disagree.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const { startDate, endDate } = resolveDateRange(searchParams, 30, 366)

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  const staffRes = await auth.supabase
    .from('staff_members')
    .select('id, first_name, last_name, position, user_id, email')
    .eq('outlet_id', outletId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('first_name')
  if (staffRes.error) return fail(staffRes.error)
  const staff = staffRes.data ?? []
  const staffIds = staff.map((s) => s.id)
  if (staffIds.length === 0) return NextResponse.json({ rows: [], totals: null })

  const [attRes, schedRes, usersRes, incRes, advRes, slipRes] = await Promise.all([
    auth.supabase.from('attendance').select('staff_id, attendance_date, clock_in_time, status').in('staff_id', staffIds).gte('attendance_date', startDate).lte('attendance_date', endDate),
    auth.supabase.from('staff_schedules').select('staff_id, work_date, shifts(start_time)').in('staff_id', staffIds).gte('work_date', startDate).lte('work_date', endDate),
    auth.supabase.from('users').select('id, email').eq('company_id', auth.company_id),
    auth.supabase.from('daily_incentives').select('staff_id, amount').eq('outlet_id', outletId).gte('incentive_date', startDate).lte('incentive_date', endDate),
    auth.supabase.from('cash_advances').select('id, staff_id, amount, status, repay_per_period').eq('outlet_id', outletId).eq('status', 'paid_out'),
    auth.supabase
      .from('payslips')
      .select('staff_id, net_pay, payroll_runs!inner(period_start, period_end, status)')
      .in('staff_id', staffIds)
      .eq('payroll_runs.status', 'paid')
      .lte('payroll_runs.period_start', endDate)
      .gte('payroll_runs.period_end', startDate),
  ])
  for (const r of [attRes, schedRes, incRes, advRes, slipRes]) if (r.error) return fail(r.error)

  const userIdByEmail = new Map((usersRes.data ?? []).map((u) => [u.email, u.id]))
  const userIdOf = new Map(staff.map((s) => [s.id, s.user_id ?? (s.email ? userIdByEmail.get(s.email) : undefined)]))
  const userIds = Array.from(new Set(Array.from(userIdOf.values()).filter((v): v is string => !!v)))

  const leaveRes = userIds.length
    ? await auth.supabase
        .from('leave_requests')
        .select('requested_by, leave_type, start_date, end_date')
        .in('requested_by', userIds)
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate)
    : { data: [], error: null }
  if (leaveRes.error) return fail(leaveRes.error)

  const advIds = (advRes.data ?? []).map((a) => a.id)
  const repaid = new Map<string, number>()
  if (advIds.length) {
    const { data: reps } = await auth.supabase.from('cash_advance_repayments').select('advance_id, amount').in('advance_id', advIds)
    for (const r of reps ?? []) repaid.set(r.advance_id, (repaid.get(r.advance_id) ?? 0) + r.amount)
  }

  type Sched = { staff_id: string; work_date: string; shifts: { start_time: string } | { start_time: string }[] | null }
  const shiftStart = new Map(
    ((schedRes.data ?? []) as unknown as Sched[]).map((s) => [`${s.staff_id}|${s.work_date}`, (Array.isArray(s.shifts) ? s.shifts[0] : s.shifts)?.start_time ?? null])
  )

  const rows = staff.map((st) => {
    const att = (attRes.data ?? []).filter((a) => a.staff_id === st.id)
    let lateDays = 0
    let lateMin = 0
    for (const a of att) {
      const m = lateMinutes(a.clock_in_time, shiftStart.get(`${st.id}|${a.attendance_date}`) ?? null)
      lateMin += m
      if (a.status === 'late' || m > 0) lateDays += 1
    }
    const uid = userIdOf.get(st.id)
    const leaveDays = (type: string) =>
      (leaveRes.data ?? [])
        .filter((l) => l.requested_by === uid && l.leave_type === type)
        .reduce((sum, l) => sum + leaveDaysWithin(l.start_date, l.end_date, startDate, endDate), 0)
    type Slip = { staff_id: string; net_pay: number }
    return {
      staff_id: st.id,
      name: `${st.first_name} ${st.last_name ?? ''}`.trim(),
      position: st.position,
      present_days: att.filter((a) => a.status !== 'absent').length,
      absent_days: att.filter((a) => a.status === 'absent').length,
      late_days: lateDays,
      late_minutes: lateMin,
      cuti_days: leaveDays('cuti'),
      sakit_days: leaveDays('sakit'),
      izin_days: leaveDays('izin'),
      libur_days: leaveDays('libur'),
      incentive_total: (incRes.data ?? []).filter((i) => i.staff_id === st.id).reduce((sum, i) => sum + i.amount, 0),
      kasbon_outstanding: (advRes.data ?? []).filter((a) => a.staff_id === st.id).reduce((sum, a) => sum + outstandingBalance(a, repaid.get(a.id) ?? 0), 0),
      net_pay_paid: ((slipRes.data ?? []) as unknown as Slip[]).filter((p) => p.staff_id === st.id).reduce((sum, p) => sum + p.net_pay, 0),
    }
  })

  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)
  return NextResponse.json({
    rows,
    totals: {
      present_days: sum('present_days'),
      absent_days: sum('absent_days'),
      late_days: sum('late_days'),
      late_minutes: sum('late_minutes'),
      incentive_total: sum('incentive_total'),
      kasbon_outstanding: sum('kasbon_outstanding'),
      net_pay_paid: sum('net_pay_paid'),
    },
  })
}
