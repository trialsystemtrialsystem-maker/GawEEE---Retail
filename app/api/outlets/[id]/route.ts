import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/outlets/:id — manager+ only, for the outlet they belong to (or
// any outlet for master_admin). Covers outlet info + the Radius Absensi
// geofence fields (Attendance module, 018_employee_expansion.sql).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/outlets/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!canAccessOutlet(auth, id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const patch: {
    name?: string
    address?: string
    city?: string
    province?: string
    phone?: string
    geofence_lat?: number | null
    geofence_lng?: number | null
    geofence_radius_m?: number | null
  } = {}
  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.address === 'string') patch.address = body.address
  if (typeof body.city === 'string') patch.city = body.city
  if (typeof body.province === 'string') patch.province = body.province
  if (typeof body.phone === 'string') patch.phone = body.phone
  if (typeof body.geofence_lat === 'number' || body.geofence_lat === null) patch.geofence_lat = body.geofence_lat
  if (typeof body.geofence_lng === 'number' || body.geofence_lng === null) patch.geofence_lng = body.geofence_lng
  if (typeof body.geofence_radius_m === 'number' || body.geofence_radius_m === null) patch.geofence_radius_m = body.geofence_radius_m

  const { data, error } = await auth.supabase.from('outlets').update(patch).eq('id', id).select().single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ outlet: data })
}
