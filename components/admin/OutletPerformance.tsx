'use client'

import { useEffect, useState, useCallback } from 'react'
import { KPICard } from '@/components/dashboard/KPICard'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SalesByHourChart } from '@/components/charts/SalesByHourChart'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface OutletRow {
  outlet_id: string
  outlet_name: string
  revenue_mtd: number
  profit_margin_percent: number
  transaction_count: number
  staff_count: number
  status: string
}

interface OutletsResponse {
  total_outlets: number
  outlets: OutletRow[]
  company_totals: {
    total_revenue_mtd: number
    total_profit_margin: number
    total_transactions: number
    total_staff: number
  }
}

interface HourBucket {
  hour: number
  revenue: number
  transaction_count: number
}
interface HourlyResponse {
  days: number
  combined: HourBucket[]
  outlets: { outlet_id: string; outlet_name: string; hourly: HourBucket[] }[]
}

function toChartData(hourly: HourBucket[]) {
  return hourly.map((h) => ({ hour: `${String(h.hour).padStart(2, '0')}:00`, total: h.revenue }))
}

interface DailyBucket {
  date: string
  revenue: number
  transaction_count: number
}
interface DailyResponse {
  days: number
  dates: string[]
  combined: DailyBucket[]
  outlets: { outlet_id: string; outlet_name: string; daily: DailyBucket[] }[]
}

function toDailyChartData(daily: DailyBucket[]) {
  return daily.map((d) => ({ hour: formatDate(d.date).slice(0, 5), total: d.revenue }))
}

export function OutletPerformance() {
  const [data, setData] = useState<OutletsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [view, setView] = useState<'monthly' | 'hourly' | 'daily'>('monthly')
  const [hourlyData, setHourlyData] = useState<HourlyResponse | null>(null)
  const [hourlyError, setHourlyError] = useState<string | null>(null)
  const [hourlyOutletId, setHourlyOutletId] = useState<string>('combined')
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null)
  const [dailyError, setDailyError] = useState<string | null>(null)
  const [dailyOutletId, setDailyOutletId] = useState<string>('combined')
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outlets')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal memuat data')
        return
      }
      setData(json)
    } catch {
      setError('Terjadi kesalahan jaringan')
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const loadHourly = useCallback(async () => {
    setHourlyError(null)
    try {
      const res = await fetch('/api/admin/outlets/hourly?days=7')
      const json = await res.json()
      if (!res.ok) {
        setHourlyError(typeof json.error === 'string' ? json.error : 'Gagal memuat data per jam')
        return
      }
      setHourlyData(json)
    } catch {
      setHourlyError('Terjadi kesalahan jaringan')
    }
  }, [])

  useEffect(() => {
    if (view !== 'hourly' || hourlyData) return
    const timeout = setTimeout(loadHourly, 0)
    return () => clearTimeout(timeout)
  }, [view, hourlyData, loadHourly])

  const loadDaily = useCallback(async () => {
    setDailyError(null)
    try {
      const res = await fetch('/api/admin/outlets/daily?days=14')
      const json = await res.json()
      if (!res.ok) {
        setDailyError(typeof json.error === 'string' ? json.error : 'Gagal memuat data harian')
        return
      }
      setDailyData(json)
    } catch {
      setDailyError('Terjadi kesalahan jaringan')
    }
  }, [])

  useEffect(() => {
    if (view !== 'daily' || dailyData) return
    const timeout = setTimeout(loadDaily, 0)
    return () => clearTimeout(timeout)
  }, [view, dailyData, loadDaily])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(typeof result.error === 'string' ? result.error : 'Gagal menambah outlet')
        return
      }
      showToast(`Outlet "${form.name}" berhasil ditambahkan`, 'success')
      setForm({ name: '', address: '', city: '', phone: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error && !data) return <Alert variant="danger">{error}</Alert>
  if (!data) return <p className="text-gray-400">Memuat…</p>

  const sorted = [...data.outlets].sort((a, b) => b.revenue_mtd - a.revenue_mtd)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Outlet'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nama Outlet"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input label="Kota" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <Input
              label="Alamat"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <Input
              label="Telepon"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Button type="submit" isLoading={isSubmitting}>
                Simpan Outlet
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total Revenue (MTD)" value={formatCurrency(data.company_totals.total_revenue_mtd)} />
        <KPICard label="Outlet Aktif" value={`${data.total_outlets}`} />
        <KPICard label="Total Transaksi" value={String(data.company_totals.total_transactions)} />
        <KPICard label="Rata-rata Margin" value={formatPercent(data.company_totals.total_profit_margin / 100)} />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setView('monthly')}
          className={`border-b-2 px-3 pb-2 text-sm font-semibold ${view === 'monthly' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Ringkasan Bulanan
        </button>
        <button
          type="button"
          onClick={() => setView('hourly')}
          className={`border-b-2 px-3 pb-2 text-sm font-semibold ${view === 'hourly' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Pola Per Jam (Hourly)
        </button>
        <button
          type="button"
          onClick={() => setView('daily')}
          className={`border-b-2 px-3 pb-2 text-sm font-semibold ${view === 'daily' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Rincian Harian
        </button>
      </div>

      {view === 'monthly' && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Outlet Performance Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Outlet</th>
                  <th className="py-2 pr-4 text-right">Revenue MTD</th>
                  <th className="py-2 pr-4 text-right">Margin</th>
                  <th className="py-2 pr-4 text-right">Transaksi</th>
                  <th className="py-2 pr-4 text-right">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((outlet, i) => (
                  <tr key={outlet.outlet_id}>
                    <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium text-gray-900">{outlet.outlet_name}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{formatCurrency(outlet.revenue_mtd)}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{formatPercent(outlet.profit_margin_percent / 100)}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{outlet.transaction_count}</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{outlet.staff_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'hourly' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pola Penjualan Per Jam</h2>
              <p className="text-sm text-gray-500">7 hari terakhir — bandingkan jam ramai antar outlet atau lihat gabungan semua outlet.</p>
            </div>
            {hourlyData && (
              <select
                value={hourlyOutletId}
                onChange={(e) => setHourlyOutletId(e.target.value)}
                className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="combined">Semua Outlet (Gabungan)</option>
                {hourlyData.outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.outlet_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {hourlyError && <Alert variant="danger">{hourlyError}</Alert>}
          {!hourlyData && !hourlyError && <p className="text-gray-400">Memuat…</p>}
          {hourlyData && (
            <SalesByHourChart
              data={toChartData(
                hourlyOutletId === 'combined'
                  ? hourlyData.combined
                  : (hourlyData.outlets.find((o) => o.outlet_id === hourlyOutletId)?.hourly ?? hourlyData.combined)
              )}
            />
          )}
        </Card>
      )}

      {view === 'daily' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Rincian Penjualan Harian</h2>
              <p className="text-sm text-gray-500">14 hari terakhir — bandingkan penjualan tiap hari antar outlet.</p>
            </div>
            {dailyData && (
              <select
                value={dailyOutletId}
                onChange={(e) => setDailyOutletId(e.target.value)}
                className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="combined">Semua Outlet (Gabungan)</option>
                {dailyData.outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.outlet_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {dailyError && <Alert variant="danger">{dailyError}</Alert>}
          {!dailyData && !dailyError && <p className="text-gray-400">Memuat…</p>}
          {dailyData && (
            <>
              <SalesByHourChart
                data={toDailyChartData(
                  dailyOutletId === 'combined'
                    ? dailyData.combined
                    : (dailyData.outlets.find((o) => o.outlet_id === dailyOutletId)?.daily ?? dailyData.combined)
                )}
              />

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-4">Tanggal</th>
                      {dailyData.outlets.map((o) => (
                        <th key={o.outlet_id} className="py-2 pr-4 text-right">
                          {o.outlet_name.replace('Toko Frozen Fresh Demo - ', '')}
                        </th>
                      ))}
                      <th className="py-2 pr-4 text-right font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyData.dates.map((date, i) => (
                      <tr key={date}>
                        <td className="py-2 pr-4 text-gray-600">{formatDate(date)}</td>
                        {dailyData.outlets.map((o) => (
                          <td key={o.outlet_id} className="py-2 pr-4 text-right text-gray-700">
                            {formatCurrency(o.daily[i]?.revenue ?? 0)}
                          </td>
                        ))}
                        <td className="py-2 pr-4 text-right font-semibold text-gray-900">{formatCurrency(dailyData.combined[i]?.revenue ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
