import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ProductReport } from '@/components/sales/ProductReport'

export default async function ProductReportPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Product Report</h1>
      {profile?.outlet_id ? (
        <ProductReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
