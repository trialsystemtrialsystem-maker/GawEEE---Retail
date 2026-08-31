import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CashierReport } from '@/components/sales/CashierReport'

export default async function CashierReportPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Cashier Report</h1>
      {profile?.outlet_id ? (
        <CashierReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
