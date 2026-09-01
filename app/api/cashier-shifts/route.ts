import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, openCashierShiftSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/cashier-shifts?outlet_id=&status=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const status = searchParams.get('status')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let query = auth.supabase
    .from('cashier_shifts')
    .select('*')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'open' | 'closed')

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  return NextResponse.json({ shifts: data })
}

// POST /api/cashier-shifts — opens a new shift. Scoped to one open shift per
// outlet at a time (v1 — see plan for the single-register assumption).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(openCashierShiftSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: existing } = await auth.supabase
    .from('cashier_shifts')
    .select('id')
    .eq('outlet_id', result.data.outlet_id)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Sudah ada shift yang sedang berjalan di outlet ini' }, { status: 400 })
  }

  const now = new Date()
  const { data, error } = await auth.supabase
    .from('cashier_shifts')
    .insert({
      outlet_id: result.data.outlet_id,
      opening_cash: result.data.opening_cash,
      shift_date: now.toISOString().slice(0, 10),
      shift_start_time: now.toISOString(),
      status: 'open',
      opened_by: auth.id,
    })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ shift: data }, { status: 201 })
}
