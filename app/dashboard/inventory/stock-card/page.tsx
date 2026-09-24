import { StockCardView } from '@/components/inventory/StockCardView'

export default async function StockCardPage({ searchParams }: { searchParams: Promise<{ product_id?: string }> }) {
  const { product_id } = await searchParams
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kartu Stok</h1>
        <p className="text-gray-500">Riwayat lengkap keluar-masuk barang dengan saldo berjalan. Pilih satu produk untuk kartu stoknya, atau biarkan semua untuk log mutasi outlet.</p>
      </div>
      <StockCardView initialProductId={product_id} />
    </div>
  )
}
