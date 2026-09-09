'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface FacilityRow {
  facility_id: string
  name: string
  total: number
  completed: number
  cancelled: number
}

export function FacilityReport() {
  const [facilities, setFacilities] = useState<FacilityRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/facility')
    const data = await res.json()
    if (res.ok) setFacilities(data.facilities ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Booking Berfasilitas</p>
          <p className="text-2xl font-bold text-gray-900">{facilities.reduce((s, f) => s + f.total, 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Fasilitas Terpakai</p>
          <p className="text-2xl font-bold text-gray-900">{facilities.length}</p>
        </div>
      </div>

      {!isLoading && facilities.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Booking per Fasilitas</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facilities} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--foreground)', fontSize: 12 }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="completed" name="Selesai" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                <Bar dataKey="cancelled" name="Dibatalkan" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Fasilitas</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Booking</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Selesai</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Dibatalkan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : facilities.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada booking dengan fasilitas</td></tr>
            ) : (
              facilities.map((f) => (
                <tr key={f.facility_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{f.name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{f.total}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{f.completed}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{f.cancelled}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
