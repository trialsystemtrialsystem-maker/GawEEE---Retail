import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const manualSchema = z.object({
  staff_id: z.string().uuid(),
  incentive_date: z.string().min(1),
  amount: z.number().positive('Nominal harus lebih dari 0'),
  rule_name: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional(),
})

// GET /api/incentives?outlet_id=&date= — every staff member's incentive rows
// for one day, with the calculation basis (managers+ only; a staff member
// reads their own through /api/staff/:id/history?type=incentive).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase
    .from('daily_incentives')
    .select('*, staff_members(first_name, last_name)')
    .eq('outlet_id', outletId)
    .eq('incentive_date', date)
    .order('created_at')
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  type Row = (typeof data)[number] & { staff_members: { first_name: string; last_name: string | null } | null }
  return NextResponse.json({
    incentives: (data as unknown as Row[]).map(({ staff_members: sm, ...r }) => ({ ...r, staff_name: sm ? `${sm.first_name} ${sm.last_name ?? ''}`.trim() : '-' })),
  })
}

// POST /api/incentives — manual entry (a bonus a manager awards outside the
// rules), payroll.manage.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(manualSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { staff_id, incentive_date, amount, rule_name, note } = result.data

  const { data: staff } = await auth.supabase.from('staff_members').select('outlet_id').eq('id', staff_id).single()
  if (!staff) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, staff.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase
    .from('daily_incentives')
    .insert({
      outlet_id: staff.outlet_id,
      staff_id,
      incentive_date,
      amount,
      rule_id: null,
      rule_name: rule_name || 'Bonus manual',
      basis: {},
      source: 'manual',
      note: note ?? null,
      created_by: auth.id,
    })
    .select()
    .single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ incentive: data }, { status: 201 })
}
