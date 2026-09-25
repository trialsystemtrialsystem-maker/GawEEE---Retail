import { createClient } from '@/lib/supabase/server'
import { resolveActiveOutletId } from '@/lib/server/activeOutlet'
import { Alert } from '@/components/ui/Alert'
import { CampaignManager } from '@/components/sales/CampaignManager'

export default async function BuyMarketingCampaignPage() {
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buy Marketing Campaign</h1>
        <p className="text-gray-500">Ajukan dan setujui anggaran kampanye iklan.</p>
      </div>
      {profile?.outlet_id ? (
        <CampaignManager outletId={profile.outlet_id} canDecide={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
