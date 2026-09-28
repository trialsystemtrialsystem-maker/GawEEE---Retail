'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Alert } from '@/components/ui/Alert'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency } from '@/lib/utils/formatting'
import type { SalesTotals, TrendPoint, Ranked, CustomerRank, Group } from '@/lib/utils/salesSummary'

interface Named {
  key: string
  name: string
  count: number
  total: number
}
interface Report {
  range: { start: string; end: string; previous: { start: string; end: string } }
  totals: SalesTotals
  previous: SalesTotals
  deltas: Record<'total' | 'invoice_count' | 'avg_basket' | 'gross_profit' | 'discount', number | null>
  trend: TrendPoint[]
  byPayment: { method: string; amount: number }[]
  byCategory: Ranked[]
  topProducts: Ranked[]
  byCashier: Named[]
  topCustomers: CustomerRank[]
  byOutlet: Named[]
}

const METHOD_LABEL: Record<string, string> = { cash: 'Tunai', e_wallet: 'E-Wallet', bank_transfer: 'Transfer Bank', card: 'Kartu', pay_later: 'Bayar Nanti', deposit: 'Deposit' }

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) return <span className="text-xs text-gray-400">vs periode lalu: –</span>
  const good = invert ? value <= 0 : value >= 0
  return (
    <span className={`text-xs font-medium ${good ? 'text-emerald-600' : 'text-red-600'}`}>
      {value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% <span className="font-normal text-gray-400">vs periode lalu</span>
    </span>
  )
}

function Kpi({ label, value, delta, invert, hint }: { label: string; value: string; delta?: number | null; invert?: boolean; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {delta !== undefined ? <Delta value={delta} invert={invert} /> : hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
    </div>
  )
}

function RankTable({ title, rows, columns }: { title: string; rows: Record<string, string | number>[]; columns: { key: string; label: string; right?: boolean }[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <ExportCsvButton filename={title.toLowerCase().replace(/\s+/g, '-')} rows={rows} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-semibold text-gray-600 ${c.right ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-gray-400">Belum ada data</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-1.5 text-gray-700 ${c.right ? 'text-right' : ''}`}>
                      {r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SalesSummaryReport({ allowAllOutlets }: { allowAllOutlets: boolean }) {
  const [range, setRange] = useState<DateRange>(defaultDateRange(30))
  const [group, setGroup] = useState<Group>('day')
  const [selectedOutlet, setSelectedOutlet] = useState('all')
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Non-owners always get their own outlet (the API defaults to it).
  const outletParam = allowAllOutlets ? `outlet_id=${selectedOutlet}&` : ''

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const res = await fetch(`/api/reports/sales-summary?${outletParam}start=${range.start}&end=${range.end}&group=${group}`)
    const data = await res.json()
    if (res.ok) setReport(data)
    else setError(typeof data.error === 'string' ? data.error : 'Gagal memuat laporan')
    setIsLoading(false)
  }, [outletParam, range, group])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const t = report?.totals
  const rp = formatCurrency

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {allowAllOutlets && <OutletSelector value={selectedOutlet} onChange={setSelectedOutlet} />}
          <DateRangePicker value={range} onChange={setRange} />
          <div className="flex gap-1 rounded-md border border-gray-200 p-1">
            {(['day', 'week', 'month'] as Group[]).map((g) => (
              <button key={g} onClick={() => setGroup(g)} className={`rounded px-3 py-1 text-sm font-medium ${group === g ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {g === 'day' ? 'Harian' : g === 'week' ? 'Mingguan' : 'Bulanan'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {isLoading && !report && <p className="text-gray-400">Memuat…</p>}

      {report && t && (
        <div className={isLoading ? 'opacity-60' : ''}>
          <p className="mb-3 text-xs text-gray-500">
            Periode {report.range.start} s/d {report.range.end} dibandingkan dengan {report.range.previous.start} s/d {report.range.previous.end}. Transaksi dibatalkan tidak dihitung.
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Total Penjualan" value={rp(t.total)} delta={report.deltas.total} />
            <Kpi label="Transaksi" value={String(t.invoice_count)} delta={report.deltas.invoice_count} />
            <Kpi label="Rata-rata per Transaksi" value={rp(t.avg_basket)} delta={report.deltas.avg_basket} />
            <Kpi
              label="Laba Kotor"
              value={t.margin_pct == null ? '–' : rp(t.gross_profit)}
              delta={t.margin_pct == null ? undefined : report.deltas.gross_profit}
              hint={t.margin_pct == null ? 'Belum ada data HPP' : undefined}
            />
            <Kpi label="Penjualan Kotor" value={rp(t.gross)} hint={`${t.items_sold} item terjual`} />
            <Kpi label="Diskon" value={rp(t.discount)} delta={report.deltas.discount} invert />
            <Kpi label="Pajak" value={rp(t.tax)} hint={`Penjualan bersih ${rp(t.net)}`} />
            <Kpi label="Margin" value={t.margin_pct == null ? '–' : `${t.margin_pct.toFixed(1)}%`} hint={`HPP tercatat untuk ${t.cost_coverage_pct.toFixed(0)}% penjualan`} />
          </div>

          {(t.unpaid_count > 0 || t.void_count > 0) && (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {t.unpaid_count > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{t.unpaid_count} transaksi belum lunas (piutang)</span>}
              {t.void_count > 0 && <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">{t.void_count} dibatalkan ({rp(t.void_total)})</span>}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Tren Penjualan</h3>
              <ExportCsvButton filename="tren-penjualan" rows={report.trend} />
            </div>
            {report.trend.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Belum ada penjualan pada periode ini.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <XAxis dataKey="key" tick={{ fill: 'var(--chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={90} />
                    <Tooltip formatter={(value, name) => (name === 'Transaksi' ? String(value) : formatCurrency(Number(value)))} contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                    <Bar dataKey="total" name="Penjualan" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <RankTable
              title="Metode Pembayaran"
              columns={[{ key: 'method', label: 'Metode' }, { key: 'amount', label: 'Diterima', right: true }]}
              rows={report.byPayment.map((p) => ({ method: METHOD_LABEL[p.method] ?? p.method, amount: rp(p.amount) }))}
            />
            <RankTable
              title="Per Kategori"
              columns={[{ key: 'label', label: 'Kategori' }, { key: 'quantity', label: 'Qty', right: true }, { key: 'revenue', label: 'Penjualan', right: true }, { key: 'profit', label: 'Laba', right: true }]}
              rows={report.byCategory.map((c) => ({ label: c.label, quantity: c.quantity, revenue: rp(c.revenue), profit: c.profit == null ? '–' : rp(c.profit) }))}
            />
            <RankTable
              title="Produk Terlaris"
              columns={[{ key: 'label', label: 'Produk' }, { key: 'quantity', label: 'Qty', right: true }, { key: 'revenue', label: 'Penjualan', right: true }, { key: 'profit', label: 'Laba', right: true }]}
              rows={report.topProducts.map((p) => ({ label: p.label, quantity: p.quantity, revenue: rp(p.revenue), profit: p.profit == null ? '–' : rp(p.profit) }))}
            />
            <RankTable
              title="Per Kasir"
              columns={[{ key: 'name', label: 'Kasir' }, { key: 'count', label: 'Transaksi', right: true }, { key: 'total', label: 'Penjualan', right: true }]}
              rows={report.byCashier.map((c) => ({ name: c.name, count: c.count, total: rp(c.total) }))}
            />
            <RankTable
              title="Pelanggan Teratas"
              columns={[{ key: 'name', label: 'Pelanggan' }, { key: 'count', label: 'Transaksi', right: true }, { key: 'total', label: 'Belanja', right: true }]}
              rows={report.topCustomers.map((c) => ({ name: c.name, count: c.count, total: rp(c.total) }))}
            />
            {report.byOutlet.length > 0 && (
              <RankTable
                title="Per Outlet"
                columns={[{ key: 'name', label: 'Outlet' }, { key: 'count', label: 'Transaksi', right: true }, { key: 'total', label: 'Penjualan', right: true }]}
                rows={report.byOutlet.map((o) => ({ name: o.name, count: o.count, total: rp(o.total) }))}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
