import Link from 'next/link'
import { SupplierList } from '@/components/suppliers/SupplierList'

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Supplier</h1>
        <Link href="/dashboard/suppliers/purchase-orders" className="text-sm text-blue-500 hover:underline">
          Lihat Purchase Order →
        </Link>
      </div>
      <SupplierList />
    </div>
  )
}
