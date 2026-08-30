'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

interface DailyPoint {
  date: string
  total_sales: number
  gross_profit: number
}

// Dataviz skill: one axis (revenue + profit share the same Rupiah scale, so
// this is not a dual-axis chart), categorical slots 1 (blue) & 2 (orange) in
// fixed order, thin 2px lines, legend always present for >=2 series, hover
// tooltip ships by default on line charts.
export function SalesTrendChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatDate(v).slice(0, 5)}
            tick={{ fill: 'var(--chart-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}jt` : `${Math.round(v / 1000)}rb`)}
            tick={{ fill: 'var(--chart-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }}
            formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
            labelFormatter={(v) => formatDate(String(v))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total_sales" name="Pendapatan" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="gross_profit" name="Laba Kotor" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
