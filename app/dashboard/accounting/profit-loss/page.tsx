import { ProfitLossView } from '@/components/accounting/ProfitLossView'

export default function ProfitLossPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Laba Rugi</h1>
      <ProfitLossView />
    </div>
  )
}
