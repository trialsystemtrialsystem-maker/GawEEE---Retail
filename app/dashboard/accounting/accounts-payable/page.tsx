import { AccountsPayableReport } from '@/components/accounting/AccountsPayableReport'

export default function AccountsPayablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hutang Usaha (Accounts Payable)</h1>
        <p className="text-gray-500">Invoice supplier yang belum lunas, dikelompokkan per supplier dan umur jatuh tempo.</p>
      </div>
      <AccountsPayableReport />
    </div>
  )
}
