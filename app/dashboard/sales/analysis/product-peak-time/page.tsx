import { PeakTimeReport } from '@/components/sales/PeakTimeReport'

export default function ProductPeakTimePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Product Peak Time</h1>
      <PeakTimeReport type="product" unit="item" />
    </div>
  )
}
