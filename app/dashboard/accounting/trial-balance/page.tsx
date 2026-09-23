import { TrialBalanceView } from '@/components/accounting/TrialBalanceView'

export default function TrialBalancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Neraca Saldo</h1>
        <p className="text-gray-500">Saldo setiap akun per tanggal tertentu — total Debit dan Kredit harus selalu seimbang.</p>
      </div>
      <TrialBalanceView />
    </div>
  )
}
