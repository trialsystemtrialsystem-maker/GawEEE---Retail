import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { PriceList } from '@/components/pos/PriceList'

export default async function DaftarHargaPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-extrabold text-emerald-800">🏷️ Daftar Harga</h1>
      {profile?.outlet_id ? <PriceList outletId={profile.outlet_id} /> : <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>}
    </div>
  )
}
