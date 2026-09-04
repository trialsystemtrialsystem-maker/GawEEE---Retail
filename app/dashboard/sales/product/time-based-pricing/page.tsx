import { TimeBasedPricingManager } from '@/components/products/TimeBasedPricingManager'

export default function TimeBasedPricingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time-Based Pricing</h1>
        <p className="text-gray-500">Harga khusus di jam/hari tertentu (mis. happy hour) — otomatis diterapkan sebagai diskon saat kasir menambah produk.</p>
      </div>
      <TimeBasedPricingManager />
    </div>
  )
}
