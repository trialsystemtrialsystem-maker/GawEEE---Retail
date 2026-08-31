import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CampaignSendManager } from '@/components/sales/CampaignSendManager'

export default async function SendMarketingCampaignPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Send Marketing Campaign</h1>
        <p className="text-gray-500">Kirim template pesan WhatsApp ke grup pelanggan tertentu.</p>
      </div>
      <Alert variant="info">
        Belum terhubung ke WhatsApp Business API asli (sama seperti menu WhatsApp) — jumlah penerima
        dihitung dari data pelanggan sungguhan, tapi pesan tidak benar-benar terkirim.
      </Alert>
      {profile?.outlet_id ? (
        <CampaignSendManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
