import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, leaveRequestSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/leave-requests?outlet_id=&status=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const status = searchParams.get('status')
  const requestedByParam = searchParams.get('requested_by')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let query = auth.supabase.from('leave_requests').select('*').eq('outlet_id', outletId).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status as 'pending' | 'approved' | 'rejected')
  if (requestedByParam) {
    query = query.eq('requested_by', requestedByParam === 'me' ? auth.id : requestedByParam)
  }

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  const userIds = Array.from(new Set((data ?? []).flatMap((r) => [r.requested_by, r.decided_by].filter((v): v is string => !!v))))
  const { data: users } = userIds.length > 0 ? await auth.supabase.from('users').select('id, full_name').in('id', userIds) : { data: [] }
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]))

  const requests = (data ?? []).map((r) => ({
    ...r,
    requested_by_name: nameById.get(r.requested_by) ?? '-',
    decided_by_name: r.decided_by ? (nameById.get(r.decided_by) ?? '-') : null,
  }))

  return NextResponse.json({ requests })
}

// POST /api/leave-requests — any authenticated staff member can request.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(leaveRequestSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('leave_requests')
    .insert({ ...result.data, requested_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ request: data }, { status: 201 })
}
