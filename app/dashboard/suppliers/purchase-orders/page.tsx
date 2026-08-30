import { createClient } from '@/lib/supabase/server'
import { PurchaseOrderList } from '@/components/purchase-orders/PurchaseOrderList'
import { Alert } from '@/components/ui/Alert'

export default async function PurchaseOrdersPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Purchase Order</h1>
      {profile?.outlet_id ? (
        <PurchaseOrderList outletId={profile.outlet_id} />
      ) : (
        <Alert variant="info">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
