import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { PettyCashReport } from '@/components/accounting/PettyCashReport'

export default async function PettyCashPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kas Kecil (Petty Cash)</h1>
        <p className="text-gray-500">Pengeluaran yang sudah disetujui dan dibayar — lihat/kelola persetujuan di Employee &gt; Approvals.</p>
      </div>
      {profile?.outlet_id ? (
        <PettyCashReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
