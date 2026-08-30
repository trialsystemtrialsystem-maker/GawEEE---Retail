import { createClient } from '@/lib/supabase/server'

/** Loads the authenticated user's app profile (role/company/outlet), used by
 * nearly every API route to authorize the request. Returns null if there is
 * no session.
 *
 * Uses getSession() rather than getUser() deliberately: getUser() re-verifies
 * the token against Supabase's Auth server on every call (~1-1.5s of network
 * latency), which is redundant here because proxy.ts's middleware already
 * calls getUser() for every request matching its matcher (which covers all
 * API routes) before this ever runs — so by the time a route handler
 * executes, this request's session has already been freshly verified this
 * same request. Reading it back from the cookie via getSession() is safe in
 * that position and avoids paying the verification cost twice per request. */
export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

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
