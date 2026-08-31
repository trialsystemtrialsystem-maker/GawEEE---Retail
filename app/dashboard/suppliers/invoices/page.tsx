import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { PurchaseInvoiceList } from '@/components/suppliers/PurchaseInvoiceList'

export default async function SupplierInvoicesPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Invoice Supplier</h1>
      {profile?.outlet_id ? (
        <PurchaseInvoiceList outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
