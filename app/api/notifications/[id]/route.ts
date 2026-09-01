import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/notifications/:id — marks a system_alerts row resolved (dismiss).
export async function PATCH(_request: NextRequest, ctx: RouteContext<'/api/notifications/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data, error } = await auth.supabase
    .from('system_alerts')
    .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: auth.id })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ alert: data })
}
