import { CashFlowView } from '@/components/accounting/CashFlowView'

export default function CashFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan Arus Kas</h1>
        <p className="text-gray-500">Pergerakan Kas dan Bank pada suatu periode, dikelompokkan berdasarkan jenis transaksi.</p>
      </div>
      <CashFlowView />
    </div>
  )
}
