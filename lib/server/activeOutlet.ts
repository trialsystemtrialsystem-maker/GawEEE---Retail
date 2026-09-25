// "Outlet aktif" for the owner (master_admin). Many dashboard pages need a
// concrete outlet to render; an owner whose users.outlet_id is null used to hit
// "Pilih outlet terlebih dahulu" on all of them. The owner's choice lives in a
// cookie set by POST /api/outlets/active (header switcher); without a valid
// choice it falls back to their own outlet, then the company's first outlet, so
// a page can never be left without one. Everyone else always gets their own
// outlet (or null) — the cookie is ignored for them.
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ACTIVE_OUTLET_COOKIE = 'gw_outlet'

export async function resolveActiveOutletId(supabase: SupabaseClient, profile: { outlet_id: string | null; role: string }): Promise<string | null> {
  if (profile.role !== 'master_admin') return profile.outlet_id

  const { data: outlets } = await supabase.from('outlets').select('id').order('name')
  if (!outlets?.length) return profile.outlet_id
  const wanted = (await cookies()).get(ACTIVE_OUTLET_COOKIE)?.value
  return outlets.find((o) => o.id === wanted)?.id ?? outlets.find((o) => o.id === profile.outlet_id)?.id ?? outlets[0].id
}
