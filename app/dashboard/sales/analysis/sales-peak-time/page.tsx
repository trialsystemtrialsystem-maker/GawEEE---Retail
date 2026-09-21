import { PeakTimeReport } from '@/components/sales/PeakTimeReport'

export default function SalesPeakTimePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sales Peak Time</h1>
      <PeakTimeReport type="sales" unit="Rp" />
    </div>
  )
}
