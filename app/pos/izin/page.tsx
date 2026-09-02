import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { LeaveRequestForm } from '@/components/staff/LeaveRequestForm'

export default async function IzinPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-extrabold text-[var(--brand-900)]">📝 Pengajuan Izin/Sakit/Libur</h1>
      {profile?.outlet_id ? <LeaveRequestForm outletId={profile.outlet_id} /> : <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>}
    </div>
  )
}
