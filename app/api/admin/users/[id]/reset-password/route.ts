import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/admin/users/:id/reset-password — master_admin only. Sets a new
// one-time temporary password (shown once to the owner, who hands it over) and
// records the reset in the audit log. Works for anyone in the company except
// other owners' accounts, whose credentials only they should control.
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/admin/users/[id]/reset-password'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const { data: target } = await auth.supabase.from('users').select('id, role, email').eq('id', id).eq('company_id', auth.company_id).maybeSingle()
  if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
  if (target.role === 'master_admin' && id !== auth.authUserId) {
    return NextResponse.json({ error: 'Password pemilik lain hanya bisa diubah oleh pemilik itu sendiri' }, { status: 409 })
  }

  const tempPassword = `${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}Aa1`
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: tempPassword })
  if (error) return NextResponse.json({ error: 'Gagal mengatur ulang password' }, { status: 500 })

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'user',
    entity_id: id,
    new_values: { password_reset: true },
    reason_for_action: 'Reset password oleh Master Admin',
    status: 'success',
  })

  return NextResponse.json({ email: target.email, temp_password: tempPassword })
}
