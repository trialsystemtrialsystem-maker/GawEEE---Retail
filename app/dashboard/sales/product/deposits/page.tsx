import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ProductDepositManager } from '@/components/products/ProductDepositManager'

export default async function ProductDepositsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Deposits</h1>
        <p className="text-gray-500">Catat uang muka pelanggan untuk produk yang belum diambil — penjualan sesungguhnya tetap dilakukan lewat Kasir saat pengambilan.</p>
      </div>
      {profile?.outlet_id ? (
        <ProductDepositManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
