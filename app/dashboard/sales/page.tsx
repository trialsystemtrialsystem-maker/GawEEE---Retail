import { InvoiceTable } from '@/components/sales/InvoiceTable'

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transaksi Hari Ini</h1>
      <InvoiceTable scope="today" />
    </div>
  )
}
