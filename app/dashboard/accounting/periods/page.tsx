import { createClient } from '@/lib/supabase/server'
import { PeriodsManager } from '@/components/accounting/PeriodsManager'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function PeriodsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tutup Buku</h1>
        <p className="text-gray-500">Kunci periode akuntansi yang sudah selesai agar angka laporan tidak berubah lagi.</p>
      </div>
      <PeriodsManager canManage={resolvePermission(profile?.role ?? '', 'journal.post', overrides)} />
    </div>
  )
}
