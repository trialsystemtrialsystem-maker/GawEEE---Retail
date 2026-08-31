import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { PaymentMethodsSettings } from '@/components/settings/PaymentMethodsSettings'

export default async function PaymentMethodsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  if (!profile?.outlet_id) {
    return <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
  }

  const { data: outlet } = await supabase.from('outlets').select('id, enabled_payment_methods').eq('id', profile.outlet_id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Metode Pembayaran</h1>
      {outlet ? (
        <PaymentMethodsSettings
          outletId={outlet.id}
          initialEnabled={outlet.enabled_payment_methods}
          canManage={['outlet_manager', 'master_admin'].includes(profile.role)}
        />
      ) : (
        <Alert variant="danger">Data outlet tidak ditemukan.</Alert>
      )}
    </div>
  )
}
