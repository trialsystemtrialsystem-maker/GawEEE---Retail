import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CustomerDataSettingsForm } from '@/components/sales/CustomerDataSettingsForm'

export default async function CustomerDataSettingPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Data Setting</h1>
        <p className="text-gray-500">Pengaturan perilaku modul pelanggan — berbeda dari Customer Custom Fields (struktur kolom data).</p>
      </div>
      {profile?.outlet_id ? (
        <CustomerDataSettingsForm outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
