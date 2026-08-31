import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { StockTurnoverReport } from '@/components/sales/StockTurnoverReport'

export default async function StockTurnoverPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock Turnover</h1>
        <p className="text-gray-500">
          Rasio HPP terjual dibanding nilai stok saat ini — angka lebih tinggi berarti stok berputar lebih cepat.
        </p>
      </div>
      {profile?.outlet_id ? (
        <StockTurnoverReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
