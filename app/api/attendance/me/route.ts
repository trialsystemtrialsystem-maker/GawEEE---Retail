import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/attendance/me — resolves the logged-in user's own staff_members
// row (via the user_id link added in migration 038) and returns today's
// attendance status plus the last 7 days, for self-service clock-in/out.
// Existing POST /api/attendance/clock-in|clock-out are reused as-is (they
// already just take a staff_id/attendance_id, no changes needed there).
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: staff } = await auth.supabase
    .from('staff_members')
    .select('id, first_name, last_name')
    .eq('user_id', auth.authUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!staff) {
    return NextResponse.json(
      { error: 'Akun Anda belum ditautkan ke data staff. Hubungi manager untuk menautkan.', linked: false },
      { status: 404 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: history, error } = await auth.supabase
    .from('attendance')
    .select('*')
    .eq('staff_id', staff.id)
    .gte('attendance_date', weekAgo)
    .lte('attendance_date', today)
    .order('attendance_date', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const todayAttendance = (history ?? []).find((a) => a.attendance_date === today) ?? null

  return NextResponse.json({ linked: true, staff, today: todayAttendance, history: history ?? [] })
}
