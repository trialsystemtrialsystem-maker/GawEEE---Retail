import { AbcAnalysisReport } from '@/components/sales/AbcAnalysisReport'

export default function AbcAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis ABC Produk (Pareto)</h1>
        <p className="text-gray-500">
          Klasifikasi produk berdasarkan kontribusi pendapatan — Kelas A adalah sedikit produk yang
          menyumbang sebagian besar pendapatan, Kelas C adalah ekor panjang bernilai kecil.
        </p>
      </div>
      <AbcAnalysisReport />
    </div>
  )
}
