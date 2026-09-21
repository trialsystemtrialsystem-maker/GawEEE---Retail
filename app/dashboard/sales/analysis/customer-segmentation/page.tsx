import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CustomerSegmentationReport } from '@/components/sales/CustomerSegmentationReport'

export default async function CustomerSegmentationPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Segmentasi Pelanggan (RFM)</h1>
        <p className="text-gray-500">
          Klasifikasi pelanggan berdasarkan Recency (seberapa baru belanja), Frequency (seberapa sering), dan
          Monetary (seberapa besar) — dengan rekomendasi aksi per segmen.
        </p>
      </div>
      {profile?.outlet_id ? (
        <CustomerSegmentationReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
