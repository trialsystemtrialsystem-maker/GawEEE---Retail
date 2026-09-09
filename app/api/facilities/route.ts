import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, facilitySchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/facilities?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('facilities')
    .select('*')
    .eq('outlet_id', outletId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ facilities: data })
}

// POST /api/facilities — manager+ only.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(facilitySchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('facilities')
    .insert({ ...result.data, created_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ facility: data }, { status: 201 })
}
