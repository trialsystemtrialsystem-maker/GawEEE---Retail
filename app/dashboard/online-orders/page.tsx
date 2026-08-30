import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { OnlineOrdersManager } from '@/components/online-orders/OnlineOrdersManager'

export default async function OnlineOrdersPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Order Online</h1>
        <p className="text-gray-500">Catat &amp; kelola pesanan dari WhatsApp, Instagram, atau marketplace.</p>
      </div>
      {profile?.outlet_id ? (
        <OnlineOrdersManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
