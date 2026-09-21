import { TargetVsActualReport } from '@/components/dashboard/TargetVsActualReport'

export default function TargetVsActualPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Target vs Aktual Penjualan</h1>
        <p className="text-gray-500">Pencapaian penjualan hari ini dan bulan berjalan dibanding target yang ditetapkan.</p>
      </div>
      <TargetVsActualReport />
    </div>
  )
}
