import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { handleDatabaseError } from '@/lib/utils/errors'
import { leaveDaysWithin, lateMinutes, workedMinutes } from '@/lib/utils/employeeHistory'

const TYPES = ['overview', 'attendance', 'late', 'checklist', 'leave', 'payroll', 'sales', 'cashshift', 'incentive', 'timeline', 'documents', 'reviews'] as const
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

  // Full career timeline (not date-filtered): employment changes and manual
  // notes/warnings from staff_events, plus leave, paid-out kasbon and paid
  // payslips, newest first.
  const timelineRows = async () => {
    const [events, leave, advances, slips] = await Promise.all([
      auth.supabase.from('staff_events').select('id, event_type, from_value, to_value, occurred_on, note').eq('staff_id', id),
      userId
        ? auth.supabase.from('leave_requests').select('id, leave_type, start_date, end_date, status, reason').eq('requested_by', userId)
        : Promise.resolve({ data: [], error: null }),
      auth.supabase.from('cash_advances').select('id, amount, status, advance_date, reason').eq('staff_id', id).in('status', ['paid_out', 'repaid']),
      auth.supabase
        .from('payslips')
        .select('id, net_pay, payroll_runs!inner(period_start, period_end, status, paid_at)')
        .eq('staff_id', id)
        .eq('payroll_runs.status', 'paid'),
    ])
    for (const r of [events, leave, advances, slips]) if (r.error) throw r.error
    const fmt = (v: unknown) => (v === null || v === undefined ? '-' : typeof v === 'object' ? Object.values(v as object).join(' / ') : String(v))
    const EVENT_TITLE: Record<string, string> = {
      hired: 'Bergabung',
      position_change: 'Perubahan jabatan',
      salary_change: 'Perubahan gaji',
      contract_renewal: 'Perubahan kontrak',
      status_change: 'Perubahan status',
      warning: 'Peringatan',
      note: 'Catatan',
    }
    type Item = { id: string; date: string; kind: string; title: string; detail: string }
    const items: Item[] = []
    for (const e of events.data ?? []) {
      const manual = e.event_type === 'note' || e.event_type === 'warning'
      const change = e.from_value !== null && e.from_value !== undefined ? `${fmt(e.from_value)} → ${fmt(e.to_value)}` : fmt(e.to_value)
      items.push({ id: `e-${e.id}`, date: e.occurred_on, kind: e.event_type, title: EVENT_TITLE[e.event_type] ?? e.event_type, detail: manual ? (e.note ?? '-') : change })
    }
    for (const l of (leave.data ?? []) as { id: string; leave_type: string; start_date: string; end_date: string; status: string; reason: string | null }[]) {
      items.push({ id: `l-${l.id}`, date: l.start_date, kind: 'leave', title: `${l.leave_type} (${l.status})`, detail: `${l.start_date} s/d ${l.end_date}${l.reason ? ` — ${l.reason}` : ''}` })
    }
    for (const a of advances.data ?? []) {
      items.push({ id: `a-${a.id}`, date: a.advance_date, kind: 'kasbon', title: 'Kasbon dicairkan', detail: `Rp ${Number(a.amount).toLocaleString('id-ID')} — ${a.reason}` })
    }
    type Slip = { id: string; net_pay: number; payroll_runs: { period_start: string; period_end: string; paid_at: string | null } | { period_start: string; period_end: string; paid_at: string | null }[] }
    for (const sl of (slips.data ?? []) as unknown as Slip[]) {
      const run = Array.isArray(sl.payroll_runs) ? sl.payroll_runs[0] : sl.payroll_runs
      items.push({ id: `p-${sl.id}`, date: (run.paid_at ?? run.period_end).slice(0, 10), kind: 'payroll', title: 'Gaji dibayar', detail: `Periode ${run.period_start} s/d ${run.period_end} — Rp ${Number(sl.net_pay).toLocaleString('id-ID')}` })
    }
    return items.sort((a, b) => b.date.localeCompare(a.date))
  }

  const documentRows = async () => {
    const { data, error } = await auth.supabase
      .from('employee_documents')
      .select('id, doc_type, title, doc_number, issued_on, expires_on, file_url, notes')
      .eq('staff_id', id)
      .order('expires_on', { ascending: true, nullsFirst: false })
    if (error) throw error
    return data ?? []
  }

  const reviewRows = async () => {
    const { data, error } = await auth.supabase
      .from('performance_reviews')
      .select('id, review_date, period_label, overall_score, ratings, strengths, improvements')
      .eq('staff_id', id)
      .order('review_date', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  try {
    switch (type) {
      case 'documents':
        return NextResponse.json({ staff, rows: await documentRows() })
      case 'reviews': {
        const rows = await reviewRows()
        const avg = rows.length ? rows.reduce((s, r) => s + r.overall_score, 0) / rows.length : 0
        return NextResponse.json({ staff, rows, average_score: Math.round(avg * 10) / 10 })
      }
      case 'timeline':
        return NextResponse.json({ staff, rows: await timelineRows() })
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
        const { data: company } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
        const leaveSettings = ((company?.settings ?? {}) as { leave?: { days_per_year?: number } }).leave
        const entitlement = Number(leaveSettings?.days_per_year ?? 12)
        const year = new Date().getFullYear()
        const { data: yearLeave } = userId
          ? await auth.supabase
              .from('leave_requests')
              .select('start_date, end_date')
              .eq('requested_by', userId)
              .eq('leave_type', 'cuti')
              .eq('status', 'approved')
              .lte('start_date', `${year}-12-31`)
              .gte('end_date', `${year}-01-01`)
          : { data: [] as { start_date: string; end_date: string }[] }
        const cutiUsed = (yearLeave ?? []).reduce((sum, l) => sum + leaveDaysWithin(l.start_date, l.end_date, `${year}-01-01`, `${year}-12-31`), 0)
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
            leave_balance: { entitlement, used: cutiUsed, remaining: Math.max(0, entitlement - cutiUsed), year },
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
