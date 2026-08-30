import { InvoiceTable } from '@/components/sales/InvoiceTable'

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Semua Invoice</h1>
      <InvoiceTable scope="all" />
    </div>
  )
}
