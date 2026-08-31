import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { LoyaltyManager } from '@/components/sales/LoyaltyManager'

// Point Reward is the redemption side of the same Loyalty ledger (see
// /dashboard/sales/promotion/loyalty) — one system, not two, so this page
// renders the same manager component rather than a separate half-duplicated
// feature.
export default async function PointRewardPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Point Reward</h1>
        <p className="text-gray-500">Bagian dari program Loyalty — beri &amp; tukar poin di sini.</p>
      </div>
      {profile?.outlet_id ? (
        <LoyaltyManager outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
