import { createClient } from '@/lib/supabase/server'
import { resolveActiveOutletId } from '@/lib/server/activeOutlet'
import { Alert } from '@/components/ui/Alert'
import { QuotationManager } from '@/components/sales/QuotationManager'

export default async function SalesQuotationListPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: rawProfile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()
  // Owners (no fixed outlet) get their active outlet instead of a dead end.
  const profile = rawProfile ? { ...rawProfile, outlet_id: await resolveActiveOutletId(supabase, rawProfile) } : rawProfile

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Quotation List</h1>
        <p className="text-gray-500">Buat penawaran harga untuk pelanggan sebelum invoice dibuat.</p>
      </div>
      {profile?.outlet_id ? (
        <QuotationManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
