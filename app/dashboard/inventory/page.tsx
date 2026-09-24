import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { StockOverview } from '@/components/inventory/StockOverview'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function InventoryPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stok Barang</h1>
        <p className="text-gray-500">Pantau stok, nilai persediaan, kecepatan terjual, dan barang yang perlu dipesan atau tidak bergerak — dalam satu tampilan.</p>
      </div>
      <Suspense>
        <StockOverview canAdjust={resolvePermission(profile?.role ?? '', 'inventory.adjust', overrides)} />
      </Suspense>
    </div>
  )
}
