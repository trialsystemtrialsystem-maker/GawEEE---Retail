import { FinancialDashboard } from '@/components/financial/FinancialDashboard'
import { SalesAnalytics } from '@/components/charts/SalesAnalytics'

export default function FinancialPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Keuangan</h1>
      <FinancialDashboard />
      <div className="border-t border-gray-200 pt-6">
        <SalesAnalytics />
      </div>
    </div>
  )
}
