import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { cookies } from 'next/headers'
import { ACTIVE_OUTLET_COOKIE } from '@/lib/server/activeOutlet'

// GET /api/outlets — lightweight outlet list for pickers (report "Semua
// Outlet vs outlet tertentu" selectors, etc.). A master_admin sees every
// outlet in their company; anyone else sees only their own outlet — this is
// a list endpoint, not a single-outlet fetch, so it can't lean on
// canAccessOutlet()'s per-id check the way GET /api/outlets/:id does.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = auth.supabase.from('outlets').select('id, name').eq('company_id', auth.company_id).order('name')
  if (auth.role !== 'master_admin') {
    if (!auth.outlet_id) return NextResponse.json({ outlets: [] })
    query = query.eq('id', auth.outlet_id)
  }

  const { data, error } = await query
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  // The outlet pages should default to: the owner's chosen one (header
  // switcher), else their own, else the first; everyone else gets their own.
  const wanted = (await cookies()).get(ACTIVE_OUTLET_COOKIE)?.value
  const list = data ?? []
  const active =
    auth.role === 'master_admin'
      ? (list.find((o) => o.id === wanted)?.id ?? list.find((o) => o.id === auth.outlet_id)?.id ?? list[0]?.id ?? null)
      : auth.outlet_id
  return NextResponse.json({ outlets: data ?? [], own_outlet_id: auth.outlet_id, active_outlet_id: active })
}
