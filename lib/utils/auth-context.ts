import { createClient } from '@/lib/supabase/server'

/** Loads the authenticated user's app profile (role/company/outlet), used by
 * nearly every API route to authorize the request. Returns null if there is
 * no session. */
export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, company_id, outlet_id, role, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active') return null

  return { supabase, authUserId: user.id, ...profile }
}

export type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>

/** True if the user may act on `outletId` — their own outlet, or (for
 * master_admin) any outlet, left to RLS/the query to further scope by company. */
export function canAccessOutlet(ctx: AuthContext, outletId: string) {
  return ctx.role === 'master_admin' || ctx.outlet_id === outletId
}
