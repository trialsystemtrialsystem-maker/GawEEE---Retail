import { createClient } from '@/lib/supabase/server'
import { IncentiveManager } from '@/components/staff/IncentiveManager'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function IncentivesPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insentif Harian</h1>
        <p className="text-gray-500">Atur aturan insentif, hitung otomatis dari penjualan dan absensi tiap hari, dan lihat dasar perhitungannya.</p>
      </div>
      <IncentiveManager canManage={resolvePermission(profile?.role ?? '', 'payroll.manage', overrides)} />
    </div>
  )
}
