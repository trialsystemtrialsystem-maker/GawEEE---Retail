'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'

interface TargetData {
  configured: boolean
  note?: string
  target_daily_revenue?: number
  today?: { date: string; actual: number; target: number; achievement_pct: number }
  mtd?: { actual: number; target: number; achievement_pct: number; month_target: number; month_achievement_pct: number }
  pace?: { days_remaining: number; remaining_to_hit_month_target: number; required_daily_pace: number }
  daily?: { date: string; actual: number; target: number }[]
}

function AchievementBadge({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'var(--status-good)' : pct >= 80 ? 'var(--status-warning)' : 'var(--status-critical)'
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, white)`, color }}>
      {pct.toFixed(0)}%
    </span>
  )
}

export function TargetVsActualReport({ outletId }: { outletId?: string }) {
  const [data, setData] = useState<TargetData | null>(null)
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const effectiveOutlet = outletId ?? selectedOutlet

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/target-vs-actual?outlet_id=${effectiveOutlet}`)
    const json = await res.json()
    if (res.ok) setData(json)
    setIsLoading(false)
  }, [effectiveOutlet])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const selector = !outletId && <OutletSelector value={selectedOutlet} onChange={setSelectedOutlet} />

  if (isLoading) return <p className="text-sm text-gray-400">Memuat…</p>

  if (!data?.configured) {
    return (
      <div className="space-y-3">
        {selector}
        <Alert variant="info">
          {data?.note ?? 'Target penjualan belum ditetapkan.'}{' '}
          <Link href="/dashboard/settings" className="font-medium underline">
            Atur target sekarang
          </Link>
        </Alert>
      </div>
    )
  }

  const { today, mtd, pace, daily } = data

  return (
    <div className="space-y-4">
      {(selector || (daily && daily.length > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{selector}</div>
          {daily && daily.length > 0 && <ExportCsvButton filename="target-vs-actual" rows={daily} />}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Hari Ini</p>
            <AchievementBadge pct={today!.achievement_pct} />
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(today!.actual)}</p>
          <p className="text-xs text-gray-500">dari target {formatCurrency(today!.target)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Bulan Berjalan (MTD)</p>
            <AchievementBadge pct={mtd!.achievement_pct} />
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(mtd!.actual)}</p>
          <p className="text-xs text-gray-500">dari target {formatCurrency(mtd!.target)} sampai hari ini</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Proyeksi Target Bulan Ini</p>
            <AchievementBadge pct={mtd!.month_achievement_pct} />
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(mtd!.month_target)}</p>
          <p className="text-xs text-gray-500">
            {pace!.days_remaining > 0
              ? `Butuh ${formatCurrency(pace!.required_daily_pace)}/hari selama ${pace!.days_remaining} hari tersisa`
              : 'Bulan sudah berakhir'}
          </p>
        </div>
      </div>

      {daily && daily.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Aktual vs Target Harian (Bulan Ini)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: 'var(--chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatDate(v)} />
                <YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip labelFormatter={(v) => formatDate(String(v))} formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="actual" name="Aktual" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Line dataKey="target" name="Target" stroke="var(--status-critical)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
