import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createCashAdvanceSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { outstandingBalance } from '@/lib/utils/cashAdvance'

// GET /api/cash-advances?outlet_id=&staff_id=&status= — kasbon list with each
// advance's repaid total and outstanding balance. Managers see their outlet;
// a non-manager only ever sees their own advances.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const staffId = searchParams.get('staff_id')
  const status = searchParams.get('status')
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const isManager = ['outlet_manager', 'master_admin'].includes(auth.role)
  let query = auth.supabase
    .from('cash_advances')
    .select('*, staff_members(first_name, last_name, user_id, email)')
    .eq('outlet_id', outletId)
    .order('advance_date', { ascending: false })
  if (staffId) query = query.eq('staff_id', staffId)
  if (status) query = query.eq('status', status as 'pending')

  const { data, error } = await query
  if (error) {
    const { status: s, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: s })
  }

  type Row = (typeof data)[number] & { staff_members: { first_name: string; last_name: string | null; user_id: string | null; email: string | null } | null }
  let rows = (data ?? []) as unknown as Row[]
  if (!isManager) rows = rows.filter((r) => r.staff_members?.user_id === auth.id)

  const ids = rows.map((r) => r.id)
  const repaidById = new Map<string, number>()
  if (ids.length > 0) {
    const { data: reps } = await auth.supabase.from('cash_advance_repayments').select('advance_id, amount').in('advance_id', ids)
    for (const r of reps ?? []) repaidById.set(r.advance_id, (repaidById.get(r.advance_id) ?? 0) + r.amount)
  }

  return NextResponse.json({
    advances: rows.map((r) => {
      const repaid = repaidById.get(r.id) ?? 0
      const { staff_members: sm, ...rest } = r
      return { ...rest, staff_name: sm ? `${sm.first_name} ${sm.last_name ?? ''}`.trim() : '-', repaid, outstanding: outstandingBalance(r, repaid) }
    }),
  })
}

// POST /api/cash-advances — a manager files one for any staff member in their
// outlet; anyone else files one for their own linked staff record.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = validate(createCashAdvanceSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { amount, reason, repay_per_period, advance_date } = result.data

  const isManager = ['outlet_manager', 'master_admin'].includes(auth.role)
  let staffId = result.data.staff_id
  if (!isManager || !staffId) {
    const { data: own } = await auth.supabase.from('staff_members').select('id').eq('user_id', auth.id).is('deleted_at', null).maybeSingle()
    if (!own) return NextResponse.json({ error: 'Akun Anda belum terhubung ke data karyawan' }, { status: 400 })
    staffId = own.id
  }

  const { data: staff } = await auth.supabase.from('staff_members').select('outlet_id, status').eq('id', staffId).single()
  if (!staff) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, staff.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase
    .from('cash_advances')
    .insert({
      outlet_id: staff.outlet_id,
      staff_id: staffId,
      amount,
      reason,
      repay_per_period: repay_per_period ?? 0,
      advance_date: advance_date ?? new Date().toISOString().slice(0, 10),
      requested_by: auth.id,
    })
    .select()
    .single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ advance: data }, { status: 201 })
}
