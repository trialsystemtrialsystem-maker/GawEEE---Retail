'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

interface Coupon {
  code: string
  discount_type: string
  discount_value: number
  usage_count: number
  usage_limit: number | null
  is_active: boolean
}
interface Promotion {
  name: string
  discount_type: string
  discount_value: number
  start_date: string
  end_date: string
}
interface LoyaltyMonth {
  month: string
  issued: number
  redeemed: number
}

export function PromoLoyaltyReport() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loyaltyByMonth, setLoyaltyByMonth] = useState<LoyaltyMonth[]>([])
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/promo-loyalty')
    const data = await res.json()
    if (res.ok) {
      setCoupons(data.coupons ?? [])
      setPromotions(data.promotions ?? [])
      setLoyaltyByMonth(data.loyaltyByMonth ?? [])
      setNote(data.note ?? '')
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const totalUsage = coupons.reduce((s, c) => s + c.usage_count, 0)
  const totalIssued = loyaltyByMonth.reduce((s, m) => s + m.issued, 0)
  const totalRedeemed = loyaltyByMonth.reduce((s, m) => s + m.redeemed, 0)

  return (
    <div className="space-y-4">
      {note && <Alert variant="info">{note}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Pemakaian Kupon</p>
          <p className="text-2xl font-bold text-gray-900">{totalUsage}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Poin Loyalitas Diberikan</p>
          <p className="text-2xl font-bold text-gray-900">{totalIssued}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Poin Loyalitas Ditukar</p>
          <p className="text-2xl font-bold text-gray-900">{totalRedeemed}</p>
        </div>
      </div>

      {!isLoading && loyaltyByMonth.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Poin Loyalitas per Bulan</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loyaltyByMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--chart-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="issued" name="Diberikan" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="redeemed" name="Ditukar" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kode Kupon</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Diskon</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Terpakai</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada kupon</td></tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.code} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{c.code}</td>
                  <td className="px-4 py-2 text-gray-600">{c.discount_type === 'percentage' ? `${c.discount_value}%` : formatCurrency(c.discount_value)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {c.usage_count}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Promosi Aktif</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Promosi</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Diskon</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Periode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : promotions.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Tidak ada promosi aktif</td></tr>
              ) : (
                promotions.map((p) => (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{p.name}</td>
                    <td className="px-4 py-2 text-gray-600">{p.discount_type === 'percentage' ? `${p.discount_value}%` : formatCurrency(p.discount_value)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatDate(p.start_date)} – {formatDate(p.end_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
