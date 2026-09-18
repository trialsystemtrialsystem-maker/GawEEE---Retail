import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { AccountsReceivableReport } from '@/components/accounting/AccountsReceivableReport'

export default async function AccountsReceivablePage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Piutang Usaha (Accounts Receivable)</h1>
        <p className="text-gray-500">Transaksi pelanggan yang belum lunas (bayar nanti / menunggu settlement), dikelompokkan per pelanggan dan umur piutang.</p>
      </div>
      {profile?.outlet_id ? (
        <AccountsReceivableReport outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
