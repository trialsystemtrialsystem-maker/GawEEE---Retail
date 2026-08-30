import { ProductList } from '@/components/products/ProductList'

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Kategori Produk</h1>
      <ProductList />
    </div>
  )
}
