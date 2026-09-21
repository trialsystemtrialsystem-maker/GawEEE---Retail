import { NewVsReturningReport } from '@/components/sales/NewVsReturningReport'

export default function NewVsReturningPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pelanggan Baru vs Lama</h1>
        <p className="text-gray-500">
          Pertumbuhan dari akuisisi pelanggan baru dibanding retensi pelanggan lama, per bulan.
        </p>
      </div>
      <NewVsReturningReport />
    </div>
  )
}
