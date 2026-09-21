import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { AbcAnalysisReport } from '@/components/sales/AbcAnalysisReport'

export default async function AbcAnalysisPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis ABC Produk (Pareto)</h1>
        <p className="text-gray-500">
          Klasifikasi produk berdasarkan kontribusi pendapatan — Kelas A adalah sedikit produk yang
          menyumbang sebagian besar pendapatan, Kelas C adalah ekor panjang bernilai kecil.
        </p>
      </div>
      {profile?.outlet_id ? (
        <AbcAnalysisReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
