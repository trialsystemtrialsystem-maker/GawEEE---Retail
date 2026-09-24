import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { handleDatabaseError } from '@/lib/utils/errors'
import { leaveDaysWithin, lateMinutes, workedMinutes } from '@/lib/utils/employeeHistory'

const TYPES = ['overview', 'attendance', 'late', 'checklist', 'leave', 'payroll', 'sales', 'cashshift', 'incentive'] as const
type HistoryType = (typeof TYPES)[number]

// GET /api/staff/:id/history?type=&start=&end= — Employee 360 (todo.md
// Phase 33). One route, one `type` per history tab, so every tab shares the
// same access check and the same staff -> user resolution. attendance/
// cashier_shifts/payslips/schedules are keyed by staff_members.id, while
// leave requests, checklist completions and sales are keyed by users.id — the
// link is staff_members.user_id (038) with the same email fallback payroll
// uses when a staff member was never linked.
export async function GET(request: NextRequest, ctx: RouteContext<'/api/staff/[id]/history'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { searchParams } = request.nextUrl
  const type = (searchParams.get('type') ?? 'overview') as HistoryType
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'type tidak valid' }, { status: 400 })

  const { data: staff, error: staffError } = await auth.supabase.from('staff_members').select('*').eq('id', id).single()
  if (staffError || !staff) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, staff.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  // A cashier/staff may only read their own history; managers+ read anyone in
  // their outlet.
  const isManager = ['outlet_manager', 'master_admin'].includes(auth.role)
  let userId: string | null = staff.user_id ?? null
  if (!userId && staff.email) {
    const { data: u } = await auth.supabase.from('users').select('id').eq('company_id', auth.company_id).eq('email', staff.email).maybeSingle()
    userId = u?.id ?? null
  }
  if (!isManager && userId !== auth.id) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { startDate, endDate, startIso, endIso } = resolveDateRange(searchParams, 30, 3650)
  const fail = (e: { message: string }) => {
    const { status, message } = handleDatabaseError(e as Parameters<typeof handleDatabaseError>[0])
    return NextResponse.json({ error: message }, { status })
  }

  const attendanceRows = async () => {
    const { data, error } = await auth.supabase
      .from('attendance')
      .select('id, attendance_date, clock_in_time, clock_out_time, status, notes')
      .eq('staff_id', id)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false })
    if (error) throw error
    const { data: schedules } = await auth.supabase
      .from('staff_schedules')
      .select('work_date, shifts(name, start_time, end_time)')
      .eq('staff_id', id)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
    type Sched = { work_date: string; shifts: { name: string; start_time: string; end_time: string } | { name: string; start_time: string; end_time: string }[] | null }
    const shiftByDate = new Map(
      ((schedules ?? []) as unknown as Sched[]).map((s) => [s.work_date, Array.isArray(s.shifts) ? s.shifts[0] : s.shifts])
    )
    return (data ?? []).map((a) => {
      const shift = shiftByDate.get(a.attendance_date) ?? null
      return {
        ...a,
        shift_name: shift?.name ?? null,
        shift_start: shift?.start_time ?? null,
        late_minutes: lateMinutes(a.clock_in_time, shift?.start_time ?? null),
        worked_minutes: workedMinutes(a.clock_in_time, a.clock_out_time),
      }
    })
  }

  const leaveRows = async () => {
    if (!userId) return []
    const { data, error } = await auth.supabase
      .from('leave_requests')
      .select('id, leave_type, start_date, end_date, reason, status, decided_at, created_at')
      .eq('requested_by', userId)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map((l) => ({ ...l, days: leaveDaysWithin(l.start_date, l.end_date, startDate, endDate) }))
  }

  const payrollRows = async () => {
    const { data, error } = await auth.supabase
      .from('payslips')
      .select('id, base_salary, commission_amount, deductions, net_pay, payroll_runs!inner(period_start, period_end, status, paid_at)')
      .eq('staff_id', id)
      .lte('payroll_runs.period_start', endDate)
      .gte('payroll_runs.period_end', startDate)
    if (error) throw error
    type Row = { id: string; base_salary: number; commission_amount: number; deductions: number; net_pay: number; payroll_runs: { period_start: string; period_end: string; status: string; paid_at: string | null } | { period_start: string; period_end: string; status: string; paid_at: string | null }[] }
    return ((data ?? []) as unknown as Row[])
      .map((p) => {
        const run = Array.isArray(p.payroll_runs) ? p.payroll_runs[0] : p.payroll_runs
        return { id: p.id, base_salary: p.base_salary, commission_amount: p.commission_amount, deductions: p.deductions, net_pay: p.net_pay, ...run }
      })
      .sort((a, b) => b.period_start.localeCompare(a.period_start))
  }

  const checklistRows = async () => {
    if (!userId) return []
    const { data, error } = await auth.supabase
      .from('checklist_completions')
      .select('id, shift_date, completed_at, note, checklist_items(label, category)')
      .eq('completed_by', userId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('completed_at', { ascending: false })
    if (error) throw error
    type Row = { id: string; shift_date: string; completed_at: string; note: string | null; checklist_items: { label: string; category: string } | { label: string; category: string }[] | null }
    return ((data ?? []) as unknown as Row[]).map((c) => {
      const item = Array.isArray(c.checklist_items) ? c.checklist_items[0] : c.checklist_items
      return { id: c.id, shift_date: c.shift_date, completed_at: c.completed_at, note: c.note, label: item?.label ?? '-', category: item?.category ?? '-' }
    })
  }

  const salesRows = async () => {
    if (!userId) return []
    const { data, error } = await auth.supabase
      .from('invoices')
      .select('created_at, total, order_status')
      .eq('cashier_id', userId)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
    if (error) throw error
    const byDay = new Map<string, { date: string; transactions: number; revenue: number; voided: number }>()
    for (const inv of data ?? []) {
      const date = inv.created_at.slice(0, 10)
      const row = byDay.get(date) ?? { date, transactions: 0, revenue: 0, voided: 0 }
      if (inv.order_status === 'voided') row.voided += 1
      else {
        row.transactions += 1
        row.revenue += inv.total
      }
      byDay.set(date, row)
    }
    return Array.from(byDay.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({ ...r, average: r.transactions > 0 ? Math.round(r.revenue / r.transactions) : 0 }))
  }

  const cashShiftRows = async () => {
    const { data, error } = await auth.supabase
      .from('cashier_shifts')
      .select('id, shift_date, shift_start_time, shift_end_time, opening_cash, closing_cash, expected_closing_cash, cash_variance, reconciled')
      .eq('staff_id', id)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  const incentiveRows = async () => {
    const { data, error } = await auth.supabase
      .from('daily_incentives')
      .select('id, incentive_date, rule_name, amount, source, note, basis')
      .eq('staff_id', id)
      .gte('incentive_date', startDate)
      .lte('incentive_date', endDate)
      .order('incentive_date', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  try {
    switch (type) {
      case 'attendance':
        return NextResponse.json({ staff, rows: await attendanceRows() })
      case 'late': {
        const rows = (await attendanceRows()).filter((r) => r.status === 'late' || r.late_minutes > 0)
        return NextResponse.json({ staff, rows, total_late_minutes: rows.reduce((s, r) => s + r.late_minutes, 0) })
      }
      case 'leave':
        return NextResponse.json({ staff, rows: await leaveRows() })
      case 'payroll':
        return NextResponse.json({ staff, rows: await payrollRows() })
      case 'checklist':
        return NextResponse.json({ staff, rows: await checklistRows() })
      case 'sales':
        return NextResponse.json({ staff, rows: await salesRows() })
      case 'incentive': {
        const rows = await incentiveRows()
        return NextResponse.json({ staff, rows, total_amount: rows.reduce((s, r) => s + r.amount, 0) })
      }
      case 'cashshift':
        return NextResponse.json({ staff, rows: await cashShiftRows() })
      default: {
        const [att, leave, pay, checklist, sales] = await Promise.all([attendanceRows(), leaveRows(), payrollRows(), checklistRows(), salesRows()])
        const approved = leave.filter((l) => l.status === 'approved')
        const leaveDays = (t: string) => approved.filter((l) => l.leave_type === t).reduce((s, l) => s + l.days, 0)
        return NextResponse.json({
          staff,
          linked_user: userId !== null,
          summary: {
            attendance_days: att.filter((a) => a.status !== 'absent').length,
            absent_days: att.filter((a) => a.status === 'absent').length,
            late_days: att.filter((a) => a.status === 'late' || a.late_minutes > 0).length,
            late_minutes: att.reduce((s, a) => s + a.late_minutes, 0),
            worked_minutes: att.reduce((s, a) => s + a.worked_minutes, 0),
            leave_days: { izin: leaveDays('izin'), sakit: leaveDays('sakit'), libur: leaveDays('libur'), cuti: leaveDays('cuti') },
            pending_leave_requests: leave.filter((l) => l.status === 'pending').length,
            checklist_completed: checklist.length,
            net_pay_total: pay.filter((p) => p.status === 'paid').reduce((s, p) => s + p.net_pay, 0),
            payslip_count: pay.length,
            sales_revenue: sales.reduce((s, r) => s + r.revenue, 0),
            sales_transactions: sales.reduce((s, r) => s + r.transactions, 0),
            voided_transactions: sales.reduce((s, r) => s + r.voided, 0),
          },
        })
      }
    }
  } catch (e) {
    return fail(e as { message: string })
  }
}
