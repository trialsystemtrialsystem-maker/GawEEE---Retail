import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, expenseRequestSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/expense-requests?outlet_id=&status=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const status = searchParams.get('status')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let query = auth.supabase.from('expense_requests').select('*').eq('outlet_id', outletId).order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'pending' | 'approved' | 'rejected')

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  const userIds = Array.from(new Set((data ?? []).flatMap((r) => [r.requested_by, r.approved_by].filter((v): v is string => !!v))))
  const { data: users } = userIds.length > 0 ? await auth.supabase.from('users').select('id, full_name').in('id', userIds) : { data: [] }
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]))

  const requests = (data ?? []).map((r) => ({
    ...r,
    requested_by_name: nameById.get(r.requested_by) ?? '-',
    approved_by_name: r.approved_by ? (nameById.get(r.approved_by) ?? '-') : null,
  }))

  return NextResponse.json({ requests })
}

// POST /api/expense-requests — any authenticated staff member can request.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(expenseRequestSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('expense_requests')
    .insert({ ...result.data, requested_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ request: data }, { status: 201 })
}
