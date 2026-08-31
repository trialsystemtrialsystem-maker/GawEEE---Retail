import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CommissionGroupList } from '@/components/sales/CommissionGroupList'

export default async function CommissionGroupPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commission Group List</h1>
        <p className="text-gray-500">Persentase komisi penjualan per karyawan.</p>
      </div>
      {profile?.outlet_id ? (
        <CommissionGroupList outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
