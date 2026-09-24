import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { DEFAULT_PERMISSIONS, EDITABLE_ROLES, PERMISSIONS, loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

// GET/PATCH /api/admin/permissions — master_admin only. The editable role x
// action matrix, stored as overrides at companies.settings.permissions; only
// deviations from DEFAULT_PERMISSIONS need to be stored, but the GET always
// returns the fully resolved matrix so the UI doesn't reimplement defaults.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const overrides = await loadPermissionOverrides(auth.supabase, auth.company_id)
  const matrix = Object.fromEntries(
    EDITABLE_ROLES.map((role) => [role, Object.fromEntries(PERMISSIONS.map((p) => [p.key, resolvePermission(role, p.key, overrides)]))])
  )
  return NextResponse.json({ permissions: PERMISSIONS, roles: EDITABLE_ROLES, matrix })
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { role, key, allowed } = (await request.json()) as { role?: string; key?: string; allowed?: boolean }
  if (!role || !(EDITABLE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Peran tidak dapat diubah' }, { status: 400 })
  }
  if (!key || !PERMISSIONS.some((p) => p.key === key) || typeof allowed !== 'boolean') {
    return NextResponse.json({ error: 'Izin tidak valid' }, { status: 400 })
  }

  const { data: current } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  const settings = (current?.settings ?? {}) as { permissions?: Record<string, Record<string, boolean>> } & Record<string, unknown>
  const permissions = { ...(settings.permissions ?? {}) }
  const roleOverrides = { ...(permissions[role] ?? {}) }

  // Store only real deviations from the default, so the stored overrides stay
  // minimal and resetting to default is just "toggle back".
  if (DEFAULT_PERMISSIONS[role as (typeof EDITABLE_ROLES)[number]][key] === allowed) delete roleOverrides[key]
  else roleOverrides[key] = allowed
  permissions[role] = roleOverrides

  const { error } = await auth.supabase
    .from('companies')
    .update({ settings: { ...settings, permissions } })
    .eq('id', auth.company_id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'permissions',
    entity_id: auth.company_id,
    new_values: { role, key, allowed },
    status: 'success',
  })

  return NextResponse.json({ ok: true })
}
