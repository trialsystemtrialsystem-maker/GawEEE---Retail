import { ProfitLossReport } from '@/components/financial/ProfitLossReport'

export default function PnLReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ringkasan Penjualan</h1>
        <p className="text-gray-500">Pendapatan dan HPP dari transaksi penjualan — untuk Laba Rugi resmi, lihat menu Laba Rugi.</p>
      </div>
      <ProfitLossReport />
    </div>
  )
}
