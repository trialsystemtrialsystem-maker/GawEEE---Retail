import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { DeliveryManager } from '@/components/sales/DeliveryManager'

export default async function SalesDeliveryListPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Delivery List</h1>
        <p className="text-gray-500">Lacak pengiriman barang untuk invoice yang sudah selesai.</p>
      </div>
      {profile?.outlet_id ? (
        <DeliveryManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
