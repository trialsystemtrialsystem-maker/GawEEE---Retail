import { SupplierList } from '@/components/suppliers/SupplierList'

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Supplier</h1>
      <SupplierList />
    </div>
  )
}
