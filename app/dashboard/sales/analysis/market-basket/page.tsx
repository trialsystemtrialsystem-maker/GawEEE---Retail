import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { MarketBasketReport } from '@/components/sales/MarketBasketReport'

export default async function MarketBasketPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis Keranjang Belanja (Market Basket)</h1>
        <p className="text-gray-500">
          Produk apa saja yang sering dibeli bersamaan — dasar untuk bundling, promo silang, dan penempatan rak.
        </p>
      </div>
      {profile?.outlet_id ? (
        <MarketBasketReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
