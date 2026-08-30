import { Card } from '@/components/ui/Card'
import { formatCurrency, formatPercent } from '@/lib/utils/formatting'

interface ComparisonData {
  current: { revenue: number; transactions: number; profit: number }
  previous: { revenue: number; transactions: number; profit: number }
  change_percent: { revenue: number; transactions: number; profit: number }
}

function DeltaBadge({ percent }: { percent: number }) {
  const isUp = percent >= 0
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        color: isUp ? 'var(--status-good)' : 'var(--status-critical)',
        background: isUp ? 'color-mix(in srgb, var(--status-good) 12%, white)' : 'color-mix(in srgb, var(--status-critical) 12%, white)',
      }}
    >
      {isUp ? '▲' : '▼'} {formatPercent(Math.abs(percent) / 100)}
    </span>
  )
}

export function ComparisonKPIRow({ data, periodLabel }: { data: ComparisonData; periodLabel: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="space-y-1 border-l-4" style={{ borderLeftColor: 'var(--chart-1)' }}>
        <p className="text-sm text-gray-500">Pendapatan ({periodLabel})</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.current.revenue)}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <DeltaBadge percent={data.change_percent.revenue} />
          <span>vs {formatCurrency(data.previous.revenue)} periode sebelumnya</span>
        </div>
      </Card>
      <Card className="space-y-1 border-l-4" style={{ borderLeftColor: 'var(--chart-2)' }}>
        <p className="text-sm text-gray-500">Laba Kotor ({periodLabel})</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.current.profit)}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <DeltaBadge percent={data.change_percent.profit} />
          <span>vs {formatCurrency(data.previous.profit)} periode sebelumnya</span>
        </div>
      </Card>
      <Card className="space-y-1 border-l-4" style={{ borderLeftColor: 'var(--chart-3)' }}>
        <p className="text-sm text-gray-500">Transaksi ({periodLabel})</p>
        <p className="text-2xl font-bold text-gray-900">{data.current.transactions}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <DeltaBadge percent={data.change_percent.transactions} />
          <span>vs {data.previous.transactions} periode sebelumnya</span>
        </div>
      </Card>
    </div>
  )
}
