import { createClient } from '@/lib/supabase/server'
import { KPICard } from '@/components/dashboard/KPICard'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('outlet_id, role')
    .eq('id', user!.id)
    .single()

  const today = new Date().toISOString().slice(0, 10)

  const { data: summary } = profile?.outlet_id
    ? await supabase
        .from('daily_financial_summary')
        .select('*')
        .eq('outlet_id', profile.outlet_id)
        .eq('summary_date', today)
        .maybeSingle()
    : { data: null }

  const { data: lowStock } = profile?.outlet_id
    ? await supabase
        .from('v_low_stock_alerts')
        .select('product_id, name, quantity_on_hand, reorder_level')
        .eq('outlet_id', profile.outlet_id)
        .limit(5)
    : { data: [] }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ringkasan</h1>
        <p className="text-gray-500">
          {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Penjualan Hari Ini" value={formatCurrency(summary?.total_sales ?? 0)} />
        <KPICard
          label="Keuntungan"
          value={formatCurrency(summary?.gross_profit ?? 0)}
          tone={summary?.gross_profit ? 'positive' : 'neutral'}
        />
        <KPICard label="Transaksi" value={String(summary?.total_invoices ?? 0)} />
        <KPICard
          label="Stok Rendah"
          value={String(lowStock?.length ?? 0)}
          tone={(lowStock?.length ?? 0) > 0 ? 'negative' : 'neutral'}
        />
      </div>

      {!summary && (
        <Alert variant="info">
          Belum ada data transaksi untuk hari ini. Data akan muncul otomatis setelah transaksi
          pertama dibuat lewat POS.
        </Alert>
      )}

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
    </div>
  )
}
