import { CustomerSegmentationReport } from '@/components/sales/CustomerSegmentationReport'

export default function CustomerSegmentationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Segmentasi Pelanggan (RFM)</h1>
        <p className="text-gray-500">
          Klasifikasi pelanggan berdasarkan Recency (seberapa baru belanja), Frequency (seberapa sering), dan
          Monetary (seberapa besar) — dengan rekomendasi aksi per segmen.
        </p>
      </div>
      <CustomerSegmentationReport />
    </div>
  )
}
