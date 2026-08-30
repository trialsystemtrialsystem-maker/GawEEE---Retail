import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, bookingStatusSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/bookings/:id — updates status (RLS scopes the row to an accessible outlet).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/bookings/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const result = validate(bookingStatusSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('bookings')
    .update({ status: result.data.status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ booking: data })
}
