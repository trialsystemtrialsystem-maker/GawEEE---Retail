'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'

interface HourRow {
  hour: number
  total: number
  count: number
}
interface DayRow {
  day: number
  label: string
  total: number
  count: number
}

export function PeakTimeReport({ outletId, type, unit }: { outletId: string; type: 'sales' | 'product'; unit: string }) {
  const [hourly, setHourly] = useState<HourRow[]>([])
  const [daily, setDaily] = useState<DayRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/peak-time?outlet_id=${outletId}&type=${type}`)
    const data = await res.json()
    if (res.ok) {
      setHourly(data.hourly ?? [])
      setDaily(data.daily ?? [])
    }
    setIsLoading(false)
  }, [outletId, type])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (isLoading) return <p className="text-sm text-gray-400">Memuat…</p>

  const maxHourly = Math.max(1, ...hourly.map((h) => h.total))
  const maxDaily = Math.max(1, ...daily.map((d) => d.total))
  const peakHour = hourly.reduce((max, h) => (h.total > max.total ? h : max), hourly[0])
  const peakDay = daily.reduce((max, d) => (d.total > max.total ? d : max), daily[0])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gray-500">Jam Tersibuk</p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {peakHour ? `${String(peakHour.hour).padStart(2, '0')}:00 - ${String(peakHour.hour + 1).padStart(2, '0')}:00` : '-'}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Hari Tersibuk</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{peakDay?.label ?? '-'}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-gray-900">Per Jam</h3>
        <div className="space-y-1.5">
          {hourly.map((h) => (
            <div key={h.hour} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 text-gray-500">{String(h.hour).padStart(2, '0')}:00</span>
              <div className="h-4 flex-1 rounded bg-gray-100">
                <div
                  className="h-4 rounded"
                  style={{ width: `${(h.total / maxHourly) * 100}%`, background: 'var(--chart-1)' }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-gray-600">
                {h.total.toLocaleString('id-ID')} {unit}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-gray-900">Per Hari</h3>
        <div className="space-y-1.5">
          {daily.map((d) => (
            <div key={d.day} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-gray-500">{d.label}</span>
              <div className="h-4 flex-1 rounded bg-gray-100">
                <div
                  className="h-4 rounded"
                  style={{ width: `${(d.total / maxDaily) * 100}%`, background: 'var(--chart-2)' }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-gray-600">
                {d.total.toLocaleString('id-ID')} {unit}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
