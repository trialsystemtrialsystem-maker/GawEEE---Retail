import { ValuationView } from '@/components/inventory/ValuationView'

export default function ValuationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nilai Persediaan &amp; Analisis</h1>
        <p className="text-gray-500">Berapa modal yang tertanam di stok, di kategori mana, dan seberapa banyak yang tidak bergerak.</p>
      </div>
      <ValuationView />
    </div>
  )
}
