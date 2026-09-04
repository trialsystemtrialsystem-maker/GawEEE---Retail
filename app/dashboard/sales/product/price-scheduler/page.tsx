import { PriceSchedulerManager } from '@/components/products/PriceSchedulerManager'

export default function PriceSchedulerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Scheduler</h1>
        <p className="text-gray-500">Jadwalkan perubahan harga produk yang berlaku otomatis di tanggal tertentu.</p>
      </div>
      <PriceSchedulerManager />
    </div>
  )
}
