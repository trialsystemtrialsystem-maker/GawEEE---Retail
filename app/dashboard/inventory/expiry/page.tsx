import { createClient } from '@/lib/supabase/server'
import { resolveActiveOutletId } from '@/lib/server/activeOutlet'
import { Alert } from '@/components/ui/Alert'
import { ExpiryReport } from '@/components/inventory/ExpiryReport'

export default async function ExpiryReportPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Laporan Kadaluarsa</h1>
        <p className="text-gray-500">Batch barang dengan tanggal kadaluarsa yang dicatat saat penerimaan PO.</p>
      </div>
      {profile?.outlet_id ? (
        <ExpiryReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
