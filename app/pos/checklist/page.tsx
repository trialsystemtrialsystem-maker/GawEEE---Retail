import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ChecklistActivity } from '@/components/pos/ChecklistActivity'

export default async function ChecklistPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-extrabold text-[var(--brand-900)]">✅ Checklist Activity</h1>
      {profile?.outlet_id ? (
        <ChecklistActivity outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
