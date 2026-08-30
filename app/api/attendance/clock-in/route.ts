import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, clockInSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/attendance/clock-in — creates today's attendance row for a staff
// member (unique staff_id+attendance_date prevents double clock-in).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(clockInSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const status = now.getHours() >= 9 ? 'late' : 'present'

  const { data, error } = await auth.supabase
    .from('attendance')
    .insert({
      staff_id: result.data.staff_id,
      attendance_date: today,
      clock_in_time: now.toISOString(),
      status,
    })
    .select()
    .single()

  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  return NextResponse.json({ attendance: data }, { status: 201 })
}
