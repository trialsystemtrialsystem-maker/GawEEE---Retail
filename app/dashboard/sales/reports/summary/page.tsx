import { createClient } from '@/lib/supabase/server'
import { SalesSummaryReport } from '@/components/sales/SalesSummaryReport'

export default async function SalesSummaryPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role').eq('id', session!.user.id).single()
  // Owners can look across every outlet (selector inside); everyone else sees their own outlet.
  const isOwner = profile?.role === 'master_admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ringkasan Penjualan</h1>
        <p className="text-gray-500">Total, tren, dan perbandingan dengan periode sebelumnya — per metode bayar, kategori, produk, kasir, dan pelanggan.</p>
      </div>
      <SalesSummaryReport allowAllOutlets={isOwner} />
    </div>
  )
}
