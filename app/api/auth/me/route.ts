import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/me — see prd.md §4.1
export async function GET() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role, company_id, outlet_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil pengguna tidak ditemukan' }, { status: 404 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, tier')
    .eq('id', profile.company_id)
    .single()

  const outlet = profile.outlet_id
    ? (
        await supabase
          .from('outlets')
          .select('id, name, address')
          .eq('id', profile.outlet_id)
          .single()
      ).data
    : null

  return NextResponse.json({ user: profile, company, outlet })
}
