import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ExpiryReport } from '@/components/inventory/ExpiryReport'

export default async function ExpiryReportPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

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
