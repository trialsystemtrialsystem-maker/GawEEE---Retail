import type { AuthContext } from '@/lib/utils/auth-context'

export type OutletScope = { outletIds: string[]; isAll: boolean }
export interface OutletScopeResult {
  scope: OutletScope | null
  error: string | null
  status: number
}

/** Resolves a report's `outlet_id` query param into the list of outlet ids
 * to filter by — always an array, so every call site can use `.in('outlet_id',
 * outletIds)` uniformly regardless of whether it's one outlet or "all".
 * `outlet_id=all` (the <OutletSelector>'s "Semua Outlet" option) resolves to
 * every outlet in the caller's company for a master_admin, or just their own
 * single outlet otherwise (a non-master_admin can only ever see their own
 * outlet, so "all" and "their one outlet" are the same set for them —
 * nothing extra to gate). A specific outlet_id is checked against
 * canAccessOutlet() as usual. No param at all defaults to the caller's own
 * outlet for backward compatibility with every report built before the
 * outlet-selector existed. */
export async function resolveOutletScope(auth: AuthContext, outletIdParam: string | null): Promise<OutletScopeResult> {
  if (outletIdParam === 'all') {
    if (auth.role === 'master_admin') {
      const { data, error } = await auth.supabase.from('outlets').select('id').eq('company_id', auth.company_id)
      if (error) return { scope: null, error: error.message, status: 500 }
      return { scope: { outletIds: (data ?? []).map((o) => o.id), isAll: true }, error: null, status: 200 }
    }
    if (!auth.outlet_id) return { scope: null, error: 'Pilih outlet terlebih dahulu', status: 400 }
    return { scope: { outletIds: [auth.outlet_id], isAll: true }, error: null, status: 200 }
  }

  const outletId = outletIdParam ?? auth.outlet_id
  if (!outletId) return { scope: null, error: 'Pilih outlet terlebih dahulu', status: 400 }
  if (auth.role !== 'master_admin' && auth.outlet_id !== outletId) return { scope: null, error: 'Tidak memiliki izin', status: 403 }

  return { scope: { outletIds: [outletId], isAll: false }, error: null, status: 200 }
}
