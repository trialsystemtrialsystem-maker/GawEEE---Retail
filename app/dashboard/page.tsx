import { createClient } from '@/lib/supabase/server'
import { TodayOverview } from '@/components/dashboard/TodayOverview'
import { SalesAnalytics } from '@/components/charts/SalesAnalytics'
import { Card } from '@/components/ui/Card'

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  const { data: profile } = await supabase
    .from('users')
    .select('outlet_id, role')
    .eq('id', user!.id)
    .single()

  const { data: lowStock } = profile?.outlet_id
    ? await supabase
        .from('v_low_stock_alerts')
        .select('product_id, name, quantity_on_hand, reorder_level')
        .eq('outlet_id', profile.outlet_id)
        .limit(5)
    : { data: [] }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ringkasan</h1>
        <p className="text-gray-500">
          {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <TodayOverview lowStockCount={lowStock?.length ?? 0} />

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
        <SalesAnalytics />
      </div>
    </div>
  )
}
