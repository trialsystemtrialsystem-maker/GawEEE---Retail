import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/whatsapp/templates/:id — RLS scopes the row to an accessible outlet.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/whatsapp/templates/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await request.json()
  const patch: { name?: string; content?: string } = {}
  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.content === 'string') patch.content = body.content

  const { data, error } = await auth.supabase
    .from('whatsapp_templates')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ template: data })
}

// DELETE /api/whatsapp/templates/:id
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/whatsapp/templates/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { error } = await auth.supabase.from('whatsapp_templates').delete().eq('id', id)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ success: true })
}
