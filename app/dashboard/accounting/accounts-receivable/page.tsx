import { AccountsReceivableReport } from '@/components/accounting/AccountsReceivableReport'

export default function AccountsReceivablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Piutang Usaha (Accounts Receivable)</h1>
        <p className="text-gray-500">Transaksi pelanggan yang belum lunas (bayar nanti / menunggu settlement), dikelompokkan per pelanggan dan umur piutang.</p>
      </div>
      <AccountsReceivableReport />
    </div>
  )
}
