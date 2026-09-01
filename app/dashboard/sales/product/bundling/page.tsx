import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ProductBundleManager } from '@/components/sales/ProductBundleManager'

export default async function ProductBundlingPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Bundling</h1>
        <p className="text-gray-500">Paket beberapa produk dengan harga khusus — muncul sebagai aksi cepat di Kasir.</p>
      </div>
      {profile?.outlet_id ? (
        <ProductBundleManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
