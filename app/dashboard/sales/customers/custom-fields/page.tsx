import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CustomerFieldDefinitionManager } from '@/components/sales/CustomerFieldDefinitionManager'

export default async function CustomerCustomFieldsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Custom Fields</h1>
        <p className="text-gray-500">Tambah kolom data pelanggan tambahan (mis. tanggal lahir, alamat kantor).</p>
      </div>
      {profile?.outlet_id ? (
        <CustomerFieldDefinitionManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
