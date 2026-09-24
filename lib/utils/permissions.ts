import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import type { AuthContext } from '@/lib/utils/auth-context'

export type Role = 'master_admin' | 'outlet_manager' | 'cashier' | 'staff'
export const EDITABLE_ROLES = ['outlet_manager', 'cashier', 'staff'] as const

export interface PermissionDef {
  key: string
  label: string
}

// Only actions whose API routes actually call can() below — the editable
// matrix must reflect real enforcement, not a wishlist (same rule the old
// static matrix in AccessRightsManager followed). Every other route keeps its
// hardcoded role check for now (todo.md Phase 32 non-goals).
export const PERMISSIONS: PermissionDef[] = [
  { key: 'invoice.void', label: 'Void Invoice' },
  { key: 'refund.process', label: 'Proses Refund Pelanggan' },
  { key: 'inventory.adjust', label: 'Adjust Stok' },
  { key: 'catalog.manage', label: 'Kelola Supplier' },
  { key: 'po.approve', label: 'Approve Purchase Order' },
  { key: 'journal.post', label: 'Post Jurnal Akuntansi' },
  { key: 'payroll.manage', label: 'Kelola Payroll' },
]

export type PermissionKey = (typeof PERMISSIONS)[number]['key']

// Defaults are exactly what the routes enforced before this became
// configurable: outlet_manager yes, everyone else no.
export const DEFAULT_PERMISSIONS: Record<(typeof EDITABLE_ROLES)[number], Record<string, boolean>> = {
  outlet_manager: Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])),
  cashier: Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])),
  staff: Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])),
}

export type PermissionOverrides = Partial<Record<string, Record<string, boolean>>>

/** Pure resolution, split out so it's unit-testable without Supabase.
 * master_admin is always allowed (can never lock themselves out); otherwise a
 * company override wins over the default; unknown keys/roles are denied. */
export function resolvePermission(role: string, key: string, overrides: PermissionOverrides = {}): boolean {
  if (role === 'master_admin') return true
  if (!(EDITABLE_ROLES as readonly string[]).includes(role)) return false
  const override = overrides[role]?.[key]
  if (typeof override === 'boolean') return override
  return DEFAULT_PERMISSIONS[role as (typeof EDITABLE_ROLES)[number]][key] ?? false
}

export async function loadPermissionOverrides(supabase: SupabaseClient<Database>, companyId: string): Promise<PermissionOverrides> {
  const { data } = await supabase.from('companies').select('settings').eq('id', companyId).single()
  const settings = (data?.settings ?? {}) as { permissions?: PermissionOverrides }
  return settings.permissions ?? {}
}

/** Route-level check. Loads the company's overrides only when called (one
 * small query), so routes that don't use it pay nothing. */
export async function can(auth: AuthContext, key: string): Promise<boolean> {
  if (auth.role === 'master_admin') return true
  return resolvePermission(auth.role, key, await loadPermissionOverrides(auth.supabase, auth.company_id))
}
