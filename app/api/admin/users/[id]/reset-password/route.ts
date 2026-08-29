import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/admin/users/:id/reset-password — see prd.md §4.7
export async function POST(_request: Request, ctx: RouteContext<'/api/admin/users/[id]/reset-password'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data: target } = await auth.supabase.from('users').select('email').eq('id', id).eq('company_id', auth.company_id).single()
  if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })

  const admin = createAdminClient()
  const tempPassword = crypto.randomUUID().slice(0, 12)
  const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ temp_password: tempPassword, email_sent: false })
}
