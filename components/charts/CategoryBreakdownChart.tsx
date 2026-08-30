'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatting'

interface CategoryPoint {
  name: string
  revenue: number
}

// Fixed categorical slot order (dataviz skill) — assigned by first-seen
// category name, not by value/rank, so a category keeps its color even if
// the sort order changes.
const CHART_SLOTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']

export function CategoryBreakdownChart({ data }: { data: CategoryPoint[] }) {
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue)
  const colorByName = new Map(data.map((d, i) => [d.name, CHART_SLOTS[i % CHART_SLOTS.length]]))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}jt` : `${Math.round(v / 1000)}rb`)}
            tick={{ fill: 'var(--chart-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'var(--foreground)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip
            contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }}
            formatter={(value) => formatCurrency(Number(value))}
            cursor={{ fill: 'var(--brand-50)' }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {sorted.map((entry) => (
              <Cell key={entry.name} fill={colorByName.get(entry.name)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
