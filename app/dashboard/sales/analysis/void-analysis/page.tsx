import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { VoidAnalysisReport } from '@/components/sales/VoidAnalysisReport'

export default async function VoidAnalysisPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis Pembatalan Transaksi</h1>
        <p className="text-gray-500">
          Pemantauan pencegahan kecurangan — tingkat pembatalan tinggi atau terkonsentrasi pada satu kasir patut diperiksa.
        </p>
      </div>
      {profile?.outlet_id ? (
        <VoidAnalysisReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
