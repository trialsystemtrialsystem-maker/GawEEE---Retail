import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CashierShiftManager } from '@/components/pos/CashierShiftManager'

export default async function CashierShiftsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buka/Tutup Kasir</h1>
        <p className="text-gray-500">Riwayat shift kasir &amp; rekonsiliasi kas.</p>
      </div>
      {profile?.outlet_id ? (
        <CashierShiftManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
