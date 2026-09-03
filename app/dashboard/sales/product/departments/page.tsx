import { DepartmentManager } from '@/components/products/DepartmentManager'

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Department List</h1>
        <p className="text-gray-500">Kelompokkan beberapa kategori produk ke dalam satu departemen.</p>
      </div>
      <DepartmentManager />
    </div>
  )
}
