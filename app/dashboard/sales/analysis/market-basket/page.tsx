import { MarketBasketReport } from '@/components/sales/MarketBasketReport'

export default function MarketBasketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analisis Keranjang Belanja (Market Basket)</h1>
        <p className="text-gray-500">
          Produk apa saja yang sering dibeli bersamaan — dasar untuk bundling, promo silang, dan penempatan rak.
        </p>
      </div>
      <MarketBasketReport />
    </div>
  )
}
