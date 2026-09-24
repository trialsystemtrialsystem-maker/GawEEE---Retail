import { StockAcrossOutlets } from '@/components/inventory/StockAcrossOutlets'

export default function StockOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stok Semua Outlet</h1>
        <p className="text-gray-500">Posisi stok tiap produk di seluruh outlet dalam satu tabel — merah berarti sudah di bawah titik pesan.</p>
      </div>
      <StockAcrossOutlets />
    </div>
  )
}
