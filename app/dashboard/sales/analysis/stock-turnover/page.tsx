import { StockTurnoverReport } from '@/components/sales/StockTurnoverReport'

export default function StockTurnoverPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock Turnover</h1>
        <p className="text-gray-500">
          Rasio HPP terjual dibanding nilai stok saat ini — angka lebih tinggi berarti stok berputar lebih cepat.
        </p>
      </div>
      <StockTurnoverReport />
    </div>
  )
}
