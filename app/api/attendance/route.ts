import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/attendance?outlet_id=&date=YYYY-MM-DD (default today) — every
// active staff member for the outlet, with their attendance row for that
// date if one exists (so the UI can show who hasn't clocked in yet).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: staff, error: staffError } = await auth.supabase
    .from('staff_members')
    .select('id, first_name, last_name')
    .eq('outlet_id', outletId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('first_name')

  if (staffError) {
    const { status, message } = handleDatabaseError(staffError)
    return NextResponse.json({ error: message }, { status })
  }

  const staffIds = (staff ?? []).map((s) => s.id)
  const { data: attendance, error: attendanceError } =
    staffIds.length > 0
      ? await auth.supabase.from('attendance').select('*').in('staff_id', staffIds).eq('attendance_date', date)
      : { data: [], error: null }

  if (attendanceError) {
    const { status, message } = handleDatabaseError(attendanceError)
    return NextResponse.json({ error: message }, { status })
  }

  const attendanceByStaff = new Map((attendance ?? []).map((a) => [a.staff_id, a]))
  const rows = (staff ?? []).map((s) => ({ staff: s, attendance: attendanceByStaff.get(s.id) ?? null }))

  return NextResponse.json({ date, rows })
}
