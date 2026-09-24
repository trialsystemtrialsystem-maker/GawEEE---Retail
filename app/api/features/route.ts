import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/features — the company's module flags, readable by every signed-in
// user because the navigation needs them. is_master lets the nav keep
// switched-off modules visible (marked) for the owner.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  const features = ((data?.settings ?? {}) as { features?: Record<string, boolean> }).features ?? {}
  return NextResponse.json({ features, is_master: auth.role === 'master_admin' })
}
