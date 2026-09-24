import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { computeIncentives, wibDayBounds } from '@/lib/utils/incentives'
import { lateMinutes } from '@/lib/utils/employeeHistory'

const schema = z.object({ outlet_id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

// POST /api/incentives/calculate { outlet_id, date } — recomputes the AUTO
// daily incentives for every active staff member of the outlet on that
// (WIB) day from real sales, transactions and attendance, against the
// outlet's active rules. Idempotent: it replaces that day's auto rows (manual
// bonuses are never touched), so running it twice yields the same result.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const parsed = validate(schema, await request.json())
  if (!parsed.valid) return NextResponse.json({ error: parsed.errors }, { status: 400 })
  const { outlet_id, date } = parsed.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  const [rulesRes, staffRes] = await Promise.all([
    auth.supabase.from('incentive_rules').select('*').eq('outlet_id', outlet_id).eq('is_active', true),
    auth.supabase.from('staff_members').select('id, user_id, email').eq('outlet_id', outlet_id).eq('status', 'active').is('deleted_at', null),
  ])
  if (rulesRes.error) return fail(rulesRes.error)
  if (staffRes.error) return fail(staffRes.error)
  const rules = rulesRes.data ?? []
  const staff = staffRes.data ?? []
  if (rules.length === 0) return NextResponse.json({ error: 'Belum ada aturan insentif aktif' }, { status: 400 })

  const { startIso, endIso } = wibDayBounds(date)
  const [invRes, attRes, schedRes, usersRes] = await Promise.all([
    auth.supabase.from('invoices').select('cashier_id, total').eq('outlet_id', outlet_id).neq('order_status', 'voided').gte('created_at', startIso).lte('created_at', endIso),
    auth.supabase.from('attendance').select('staff_id, clock_in_time, status').eq('attendance_date', date),
    auth.supabase.from('staff_schedules').select('staff_id, shifts(start_time)').eq('work_date', date),
    auth.supabase.from('users').select('id, email').eq('company_id', auth.company_id),
  ])
  if (invRes.error) return fail(invRes.error)

  const userIdByEmail = new Map((usersRes.data ?? []).map((u) => [u.email, u.id]))
  const sales = new Map<string, { revenue: number; transactions: number }>()
  for (const inv of invRes.data ?? []) {
    const s = sales.get(inv.cashier_id) ?? { revenue: 0, transactions: 0 }
    s.revenue += inv.total
    s.transactions += 1
    sales.set(inv.cashier_id, s)
  }
  const attendanceByStaff = new Map((attRes.data ?? []).map((a) => [a.staff_id, a]))
  type Sched = { staff_id: string; shifts: { start_time: string } | { start_time: string }[] | null }
  const shiftStartByStaff = new Map(
    ((schedRes.data ?? []) as unknown as Sched[]).map((s) => [s.staff_id, (Array.isArray(s.shifts) ? s.shifts[0] : s.shifts)?.start_time ?? null])
  )

  const rows: {
    outlet_id: string
    staff_id: string
    incentive_date: string
    rule_id: string
    rule_name: string
    amount: number
    basis: Record<string, unknown>
    source: 'auto'
    created_by: string
  }[] = []
  for (const st of staff) {
    const userId = st.user_id ?? (st.email ? userIdByEmail.get(st.email) : undefined)
    const s = (userId && sales.get(userId)) || { revenue: 0, transactions: 0 }
    const att = attendanceByStaff.get(st.id)
    const results = computeIncentives(rules, {
      revenue: s.revenue,
      transactions: s.transactions,
      attended: !!att && att.status !== 'absent',
      late_minutes: lateMinutes(att?.clock_in_time ?? null, shiftStartByStaff.get(st.id) ?? null),
    })
    for (const r of results) {
      rows.push({ outlet_id, staff_id: st.id, incentive_date: date, rule_id: r.rule_id, rule_name: r.rule_name, amount: r.amount, basis: r.basis, source: 'auto', created_by: auth.id })
    }
  }

  const del = await auth.supabase.from('daily_incentives').delete().eq('outlet_id', outlet_id).eq('incentive_date', date).eq('source', 'auto')
  if (del.error) return fail(del.error)
  if (rows.length > 0) {
    const ins = await auth.supabase.from('daily_incentives').insert(rows)
    if (ins.error) return fail(ins.error)
  }

  return NextResponse.json({ date, staff_evaluated: staff.length, incentives_created: rows.length, total_amount: rows.reduce((s, r) => s + r.amount, 0) })
}
