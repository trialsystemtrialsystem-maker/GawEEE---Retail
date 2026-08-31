import Link from 'next/link'
import { Card } from '@/components/ui/Card'

export default function InvoicePaymentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Invoice Payment</h1>
      <Card className="space-y-2 text-center">
        <p className="text-4xl">💳</p>
        <p className="font-medium text-gray-900">Pembayaran invoice ada di halaman Invoice Supplier</p>
        <p className="mx-auto max-w-md text-sm text-gray-500">
          Buka detail invoice pada daftar Invoice Supplier untuk mencatat pembayaran — tidak dipisah ke
          halaman sendiri supaya riwayat invoice &amp; pembayarannya tetap dalam satu tempat.
        </p>
        <Link href="/dashboard/suppliers/invoices" className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
          Buka Invoice Supplier →
        </Link>
      </Card>
    </div>
  )
}
