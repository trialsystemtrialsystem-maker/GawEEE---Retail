import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { BookingsManager } from '@/components/bookings/BookingsManager'

export default async function BookingsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500">Kelola jadwal pre-order &amp; booking pelanggan.</p>
        </div>
      </div>
      {profile?.outlet_id ? (
        <BookingsManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
