import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/staff/:id — manager+ only, partial update. RLS scopes the row
// to an accessible outlet.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/staff/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()

  const patch: {
    first_name?: string
    last_name?: string
    email?: string | null
    phone?: string
    position?: string
    position_level_id?: string | null
    salary_amount?: number
    salary_frequency?: string
    employment_status?: string
    commission_rate?: number
    pin_code?: string | null
    status?: string
  } = {}
  if (typeof body.first_name === 'string') patch.first_name = body.first_name
  if (typeof body.last_name === 'string') patch.last_name = body.last_name
  if (typeof body.email === 'string' || body.email === null) patch.email = body.email
  if (typeof body.phone === 'string') patch.phone = body.phone
  if (typeof body.position === 'string') patch.position = body.position
  if (typeof body.position_level_id === 'string' || body.position_level_id === null) patch.position_level_id = body.position_level_id
  if (typeof body.salary_amount === 'number') patch.salary_amount = body.salary_amount
  if (typeof body.salary_frequency === 'string') patch.salary_frequency = body.salary_frequency
  if (typeof body.employment_status === 'string') patch.employment_status = body.employment_status
  if (typeof body.commission_rate === 'number') patch.commission_rate = body.commission_rate
  if (typeof body.pin_code === 'string' || body.pin_code === null) patch.pin_code = body.pin_code
  if (typeof body.status === 'string') patch.status = body.status

  const { data, error } = await auth.supabase.from('staff_members').update(patch).eq('id', id).select().single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ staff: data })
}

// DELETE /api/staff/:id — soft delete (deactivate), manager+ only.
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/staff/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { error } = await auth.supabase
    .from('staff_members')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
