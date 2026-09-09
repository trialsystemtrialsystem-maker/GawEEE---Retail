import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, prepStatusSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/invoice-items/[id]/prep-status — advance a kitchen queue line's status.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const result = validate(prepStatusSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase.from('invoice_items').update(result.data).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ item: data })
}
