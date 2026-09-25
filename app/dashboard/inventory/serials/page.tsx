import { createClient } from '@/lib/supabase/server'
import { SerialRegistry } from '@/components/inventory/SerialRegistry'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function SerialsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nomor Seri</h1>
        <p className="text-gray-500">Lacak unit per nomor seri (elektronik, peralatan, garansi): tersedia, terjual, retur, atau rusak.</p>
      </div>
      <SerialRegistry canManage={resolvePermission(profile?.role ?? '', 'inventory.adjust', overrides)} />
    </div>
  )
}
