'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatting'
import { CHART_SLOTS } from '@/lib/utils/chartColors'

interface Slice {
  name: string
  value: number
}

// Donut variant of the categorical palette convention (fixed slot order by
// first-seen name, never cycled by rank) — same rules as
// CategoryBreakdownChart, just a ring instead of horizontal bars.
export function PaymentMethodDonutChart({ data }: { data: Slice[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={CHART_SLOTS[i % CHART_SLOTS.length]} stroke="var(--chart-surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
