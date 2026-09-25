import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, type AuthContext } from '@/lib/utils/auth-context'
import { createAdminClient } from '@/lib/supabase/server'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import type { AppUser } from '@/lib/types/database.types'

// The previous PUT handed the raw body to .update(): any column could be
// rewritten (including role or company_id). Only these are editable, and the
// owner account can never be demoted or moved here.
const updateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(255),
    phone: z.string().trim().max(20).nullable(),
    role: z.enum(['outlet_manager', 'cashier', 'staff']),
    outlet_id: z.string().uuid(),
    status: z.enum(['active', 'inactive']),
  })
  .partial()

async function audit(auth: AuthContext, id: string, action: 'UPDATE' | 'DELETE', values: Record<string, unknown>, oldValues?: Record<string, unknown>) {
  await auth.supabase.from('audit_log').insert({ user_id: auth.authUserId, company_id: auth.company_id, action_type: action, entity_type: 'user', entity_id: id, old_values: oldValues ?? null, new_values: values, status: 'success' })
}

async function activeOwnerCount(auth: AuthContext) {
  const { count } = await auth.supabase.from('users').select('id', { count: 'exact', head: true }).eq('company_id', auth.company_id).eq('role', 'master_admin').eq('status', 'active')
  return count ?? 0
}

// PUT /api/admin/users/:id — see prd.md §4.7. Edit profile, role, outlet, and
// (re)activate.
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const result = validate(updateSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const patch = result.data
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

  const { data: target } = await auth.supabase.from('users').select('id, role, status, outlet_id, full_name').eq('id', id).eq('company_id', auth.company_id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })

  if (target.role === 'master_admin' && (patch.role || patch.outlet_id || patch.status === 'inactive')) {
    return NextResponse.json({ error: 'Akun pemilik (Master Admin) tidak bisa diubah peran/outlet/statusnya dari sini' }, { status: 409 })
  }
  if (id === auth.authUserId && (patch.role || patch.status === 'inactive')) {
    return NextResponse.json({ error: 'Anda tidak bisa mengubah peran atau menonaktifkan akun Anda sendiri' }, { status: 409 })
  }
  if (patch.outlet_id) {
    const { data: outlet } = await auth.supabase.from('outlets').select('id').eq('id', patch.outlet_id).eq('company_id', auth.company_id).maybeSingle()
    if (!outlet) return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 400 })
  }

  const update: Partial<AppUser> = { ...patch }
  if (patch.status === 'active') update.deleted_at = null
  if (patch.status === 'inactive') update.deleted_at = new Date().toISOString()

  const { data, error } = await auth.supabase.from('users').update(update).eq('id', id).eq('company_id', auth.company_id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  // Deactivating/reactivating must also open/close the actual sign-in.
  if (patch.status) {
    await createAdminClient().auth.admin.updateUserById(id, { ban_duration: patch.status === 'inactive' ? '876000h' : 'none' }).catch(() => {})
  }
  await audit(auth, id, 'UPDATE', patch, { role: target.role, status: target.status, outlet_id: target.outlet_id, full_name: target.full_name })

  return NextResponse.json({ user: data })
}

// DELETE /api/admin/users/:id — deactivate (soft). See prd.md §4.7. Refuses to
// deactivate yourself or the last active owner, which would lock the company out.
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (id === auth.authUserId) return NextResponse.json({ error: 'Anda tidak bisa menonaktifkan akun Anda sendiri' }, { status: 409 })

  const { data: target } = await auth.supabase.from('users').select('role').eq('id', id).eq('company_id', auth.company_id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
  if (target.role === 'master_admin' && (await activeOwnerCount(auth)) <= 1) {
    return NextResponse.json({ error: 'Ini satu-satunya pemilik aktif — tidak bisa dinonaktifkan' }, { status: 409 })
  }

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
  await audit(auth, id, 'DELETE', { status: 'inactive' })

  return NextResponse.json({ status: 'user_deactivated' })
}
