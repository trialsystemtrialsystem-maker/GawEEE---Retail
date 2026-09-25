import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { StockImport } from '@/components/inventory/StockImport'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function StockImportPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}
  const allowed = resolvePermission(profile?.role ?? '', 'inventory.adjust', overrides)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impor Stok</h1>
        <p className="text-gray-500">Masukkan saldo awal atau koreksi stok banyak produk sekaligus dari Excel/CSV. Selalu periksa dulu sebelum menerapkan.</p>
      </div>
      {allowed ? <StockImport /> : <Alert variant="danger">Anda tidak memiliki izin untuk menyesuaikan stok.</Alert>}
    </div>
  )
}
