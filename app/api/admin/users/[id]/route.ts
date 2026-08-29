import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { createAdminClient } from '@/lib/supabase/server'
import { handleDatabaseError } from '@/lib/utils/errors'

// PUT /api/admin/users/:id — see prd.md §4.7
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()

  const { data, error } = await auth.supabase
    .from('users')
    .update(body)
    .eq('id', id)
    .eq('company_id', auth.company_id)
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ user: data })
}

// DELETE /api/admin/users/:id — deactivate (soft). See prd.md §4.7.
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { error } = await auth.supabase
    .from('users')
    .update({ status: 'inactive', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', auth.company_id)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const admin = createAdminClient()
  await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' }).catch(() => {})

  return NextResponse.json({ status: 'user_deactivated' })
}
