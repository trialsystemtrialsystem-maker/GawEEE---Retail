import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { FinanceApprovals } from '@/components/staff/FinanceApprovals'

export default async function FinanceApprovalsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Persetujuan Keuangan</h1>
      {profile?.outlet_id ? (
        <FinanceApprovals outletId={profile.outlet_id} canDecide={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
