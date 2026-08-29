import { FinancialDashboard } from '@/components/financial/FinancialDashboard'

export default function FinancialPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Keuangan</h1>
      <FinancialDashboard />
    </div>
  )
}
