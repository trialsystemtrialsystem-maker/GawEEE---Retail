import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { EmployeeReport } from '@/components/sales/EmployeeReport'

export default async function EmployeeReportPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Report</h1>
        <p className="text-gray-500">Kinerja penjualan per karyawan.</p>
      </div>
      {profile?.outlet_id ? (
        <EmployeeReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
