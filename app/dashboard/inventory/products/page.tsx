import { ProductList } from '@/components/products/ProductList'

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Produk &amp; Harga</h1><p className="text-gray-500">Kelola katalog, harga, margin, dan riwayat perubahan harga; ubah banyak produk sekaligus atau impor dari spreadsheet.</p></div>
      <ProductList />
    </div>
  )
}
