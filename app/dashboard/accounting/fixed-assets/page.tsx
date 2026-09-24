import { createClient } from '@/lib/supabase/server'
import { FixedAssetsManager } from '@/components/accounting/FixedAssetsManager'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function FixedAssetsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aset Tetap &amp; Penyusutan</h1>
        <p className="text-gray-500">Daftar aset, nilai buku, dan penyusutan bulanan (garis lurus) yang otomatis dijurnal.</p>
      </div>
      <FixedAssetsManager canManage={resolvePermission(profile?.role ?? '', 'journal.post', overrides)} />
    </div>
  )
}
