import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { InventoryTable } from '@/components/inventory/InventoryTable'
import { Alert } from '@/components/ui/Alert'

export default async function InventoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Stok Barang</h1>
      {profile?.outlet_id ? (
        <Suspense>
          <InventoryTable outletId={profile.outlet_id} />
        </Suspense>
      ) : (
        <Alert variant="info">Pilih outlet terlebih dahulu untuk melihat inventori.</Alert>
      )}
    </div>
  )
}
