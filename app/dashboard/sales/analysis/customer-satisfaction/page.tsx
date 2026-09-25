import { createClient } from '@/lib/supabase/server'
import { resolveActiveOutletId } from '@/lib/server/activeOutlet'
import { Alert } from '@/components/ui/Alert'
import { CustomerSatisfactionManager } from '@/components/sales/CustomerSatisfactionManager'

export default async function CustomerSatisfactionPage() {
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
      <h1 className="text-2xl font-bold text-gray-900">Customer Satisfaction</h1>
      {profile?.outlet_id ? (
        <CustomerSatisfactionManager outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
