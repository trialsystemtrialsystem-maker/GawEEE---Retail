'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatting'

interface HourPoint {
  hour: string
  total: number
}

// Single series (one axis, no dual scale) — chart-1 in fixed slot order,
// same tooltip/grid token conventions as SalesTrendChart/CategoryBreakdownChart.
export function SalesByHourChart({ data }: { data: HourPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--chart-axis)' }} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}jt` : `${Math.round(v / 1000)}rb`)}
            tick={{ fill: 'var(--chart-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }}
            formatter={(value) => formatCurrency(Number(value))}
            cursor={{ fill: 'var(--brand-50)' }}
          />
          <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
