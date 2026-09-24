import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH/DELETE /api/incentive-rules/:id — payroll.manage. RLS scopes the row
// to an accessible outlet. Deleting a rule keeps already-paid daily_incentives
// rows (rule_id is set null; rule_name is snapshotted on each row).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/incentive-rules/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const body = (await request.json()) as { name?: string; threshold?: number; amount?: number; is_active?: boolean }
  const patch: { name?: string; threshold?: number; amount?: number; is_active?: boolean } = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.threshold === 'number' && body.threshold >= 0) patch.threshold = body.threshold
  if (typeof body.amount === 'number' && body.amount >= 0) patch.amount = body.amount
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

  const { error } = await auth.supabase.from('incentive_rules').update(patch).eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/incentive-rules/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const { error } = await auth.supabase.from('incentive_rules').delete().eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ ok: true })
}
