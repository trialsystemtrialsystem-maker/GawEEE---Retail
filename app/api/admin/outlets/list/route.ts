import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/admin/outlets/list — master_admin only. Lightweight outlet
// master-data list (name/address/city/phone/status), deliberately separate
// from GET /api/admin/outlets — that one computes MTD revenue/margin/staff
// count per outlet for the performance leaderboard (Sales > Outlet
// identification page) and is comparatively expensive; this is pure CRUD
// listing for Master Admin > Outlets, with nothing performance-related to
// compute. See todo.md Phase 28: these two were one combined page/component
// until split apart on request.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('outlets')
    .select('id, name, address, city, phone, status')
    .eq('company_id', auth.company_id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ outlets: data ?? [] })
}
