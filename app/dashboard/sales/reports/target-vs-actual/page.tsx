import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { TargetVsActualReport } from '@/components/dashboard/TargetVsActualReport'

export default async function TargetVsActualPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Target vs Aktual Penjualan</h1>
        <p className="text-gray-500">Pencapaian penjualan hari ini dan bulan berjalan dibanding target yang ditetapkan.</p>
      </div>
      {profile?.outlet_id ? (
        <TargetVsActualReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
