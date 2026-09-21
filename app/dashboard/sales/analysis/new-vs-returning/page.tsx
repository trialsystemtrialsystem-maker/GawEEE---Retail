import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { NewVsReturningReport } from '@/components/sales/NewVsReturningReport'

export default async function NewVsReturningPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pelanggan Baru vs Lama</h1>
        <p className="text-gray-500">
          Pertumbuhan dari akuisisi pelanggan baru dibanding retensi pelanggan lama, per bulan.
        </p>
      </div>
      {profile?.outlet_id ? (
        <NewVsReturningReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
