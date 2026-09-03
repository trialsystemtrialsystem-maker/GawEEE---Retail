import { ModifierManager } from '@/components/products/ModifierManager'

export default function ExtraProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Extra Product</h1>
        <p className="text-gray-500">Atur pilihan tambahan per produk (mis. Level Pedas, Tambahan Topping) — muncul sebagai pop-up saat produk ditambahkan di Kasir.</p>
      </div>
      <ModifierManager />
    </div>
  )
}
