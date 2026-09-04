import { OjolPriceListManager } from '@/components/products/OjolPriceListManager'

export default function OjolPriceListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ojek Online Price List</h1>
        <p className="text-gray-500">Referensi harga produk di masing-masing platform ojek online.</p>
      </div>
      <OjolPriceListManager />
    </div>
  )
}
