import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ProductionRunManager } from '@/components/inventory/ProductionRunManager'

export default async function StockProductionListPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Stock Production List</h1>
      {profile?.outlet_id ? (
        <ProductionRunManager outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
