import { ProfitLossReport } from '@/components/financial/ProfitLossReport'

export default function PnLReportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">P&amp;L Statement</h1>
      <ProfitLossReport />
    </div>
  )
}
