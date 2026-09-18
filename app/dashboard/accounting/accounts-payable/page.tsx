import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { AccountsPayableReport } from '@/components/accounting/AccountsPayableReport'

export default async function AccountsPayablePage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hutang Usaha (Accounts Payable)</h1>
        <p className="text-gray-500">Invoice supplier yang belum lunas, dikelompokkan per supplier dan umur jatuh tempo.</p>
      </div>
      {profile?.outlet_id ? (
        <AccountsPayableReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
