import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CustomerList } from '@/components/sales/CustomerList'

export default async function CustomersPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Customer List</h1>
      {profile?.outlet_id ? (
        <CustomerList outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
