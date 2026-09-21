import { VoidAnalysisReport } from '@/components/sales/VoidAnalysisReport'

export default function VoidAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis Pembatalan Transaksi</h1>
        <p className="text-gray-500">
          Pemantauan pencegahan kecurangan — tingkat pembatalan tinggi atau terkonsentrasi pada satu kasir patut diperiksa.
        </p>
      </div>
      <VoidAnalysisReport />
    </div>
  )
}
