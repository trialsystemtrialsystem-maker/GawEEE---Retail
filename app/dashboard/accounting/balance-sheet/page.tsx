import { BalanceSheetView } from '@/components/accounting/BalanceSheetView'

export default function BalanceSheetPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Neraca</h1>
      <BalanceSheetView />
    </div>
  )
}
