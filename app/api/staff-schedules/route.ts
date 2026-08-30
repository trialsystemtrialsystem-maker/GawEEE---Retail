import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, staffScheduleSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/staff-schedules?outlet_id=&start=&end= — assignments for staff at
// this outlet within a date range (used for the weekly schedule grid).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: staffIds } = await auth.supabase.from('staff_members').select('id').eq('outlet_id', outletId)
  const ids = (staffIds ?? []).map((s) => s.id)
  if (ids.length === 0) return NextResponse.json({ schedules: [] })

  let query = auth.supabase
    .from('staff_schedules')
    .select('*, staff_members(first_name, last_name), shifts(name, start_time, end_time)')
    .in('staff_id', ids)

  if (start) query = query.gte('work_date', start)
  if (end) query = query.lte('work_date', end)

  const { data, error } = await query
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ schedules: data })
}

// POST /api/staff-schedules — manager+ only, assigns a staff member to a
// shift on a date (unique staff_id+work_date — one shift per staff per day).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(staffScheduleSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('staff_schedules')
    .upsert(result.data, { onConflict: 'staff_id,work_date' })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ schedule: data }, { status: 201 })
}
