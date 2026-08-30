import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { WhatsappPageClient } from '@/components/whatsapp/WhatsappPageClient'

export default async function WhatsappPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  const { data: profile } = await supabase
    .from('users')
    .select('outlet_id')
    .eq('id', user!.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-gray-500">Template pesan &amp; broadcast untuk pelanggan.</p>
      </div>

      <Alert variant="info">
        Modul ini menyimpan template &amp; broadcast, tapi <strong>belum terhubung ke WhatsApp Business API asli</strong>.
        Pesan tidak benar-benar terkirim sampai integrasi API dikonfigurasi.
      </Alert>

      {profile?.outlet_id ? (
        <WhatsappPageClient outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
