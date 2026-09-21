import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { TodayOverview } from '@/components/dashboard/TodayOverview'
import { SalesAnalytics } from '@/components/charts/SalesAnalytics'
import { SalesReportGrid } from '@/components/dashboard/SalesReportGrid'
import { Card } from '@/components/ui/Card'

export default async function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', user!.id).single()

  if (profile?.role !== 'master_admin') {
    return <Alert variant="danger">Halaman ini khusus untuk Master Admin.</Alert>
  }

  const { data: outlet } = await supabase.from('outlets').select('id, name, address, city, company_id').eq('id', id).single()

  if (!outlet || outlet.company_id !== profile.company_id) {
    return <Alert variant="danger">Outlet tidak ditemukan.</Alert>
  }

  const { data: lowStock } = await supabase
    .from('v_low_stock_alerts')
    .select('product_id, name, quantity_on_hand, reorder_level')
    .eq('outlet_id', id)
    .limit(5)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/admin/outlets" className="text-sm font-medium text-[var(--brand-600)] hover:underline">
          ← Kembali ke Daftar Outlet
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{outlet.name}</h1>
        <p className="text-gray-500">
          {[outlet.address, outlet.city].filter(Boolean).join(', ') || 'Alamat belum diisi'} —{' '}
          {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <TodayOverview lowStockCount={lowStock?.length ?? 0} outletId={id} />

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Peringatan Stok Rendah</h2>
        {lowStock && lowStock.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {lowStock.map((item) => (
              <li key={item.product_id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">{item.name}</span>
                <span className="text-amber-600">
                  {item.quantity_on_hand} / {item.reorder_level} tersisa
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Tidak ada produk dengan stok rendah.</p>
        )}
      </Card>

      <div className="border-t border-gray-200 pt-6">
        <SalesAnalytics outletId={id} />
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Laporan Penjualan (30 Hari Terakhir)</h2>
        <SalesReportGrid days={30} outletId={id} />
      </div>
    </div>
  )
}
