import { ServiceProductManager } from '@/components/products/ServiceProductManager'

export default function ServiceProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Products</h1>
        <p className="text-gray-500">Produk berupa jasa (mis. potong rambut, cuci sepatu) — tanpa konsep stok.</p>
      </div>
      <ServiceProductManager />
    </div>
  )
}
