import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/customers/:id — RLS scopes the row to an accessible outlet.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/customers/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const patch: { name?: string; phone?: string; email?: string; notes?: string } = {}
  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.phone === 'string') patch.phone = body.phone
  if (typeof body.email === 'string') patch.email = body.email
  if (typeof body.notes === 'string') patch.notes = body.notes

  const { data, error } = await auth.supabase.from('customers').update(patch).eq('id', id).select().single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ customer: data })
}
