'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'

interface Pair {
  product_a: string
  product_b: string
  co_occurrence: number
  support_pct: number
  confidence_a_to_b_pct: number
  confidence_b_to_a_pct: number
  lift: number
}

export function MarketBasketReport({ outletId }: { outletId: string }) {
  const [pairs, setPairs] = useState<Pair[]>([])
  const [totalBaskets, setTotalBaskets] = useState(0)
  const [days, setDays] = useState(90)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/reports/market-basket?days=${days}`)
    const data = await res.json()
    if (res.ok) {
      setPairs(data.pairs ?? [])
      setTotalBaskets(data.total_baskets ?? 0)
      setNote(data.note ?? '')
    }
    setIsLoading(false)
  }, [days])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load, outletId])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Periode:</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-sm border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]">
            <option value={30}>30 hari terakhir</option>
            <option value={90}>90 hari terakhir</option>
            <option value={365}>1 tahun terakhir</option>
          </select>
        </div>
        <p className="text-sm text-gray-500">{totalBaskets} transaksi dianalisis</p>
      </div>

      {note && <Alert variant="info">{note}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk A</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk B</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Dibeli Bersama</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Support</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Confidence A→B</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Lift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : pairs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum cukup data transaksi berisi 2+ produk pada periode ini</td></tr>
            ) : (
              pairs.map((p) => (
                <tr key={`${p.product_a}-${p.product_b}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{p.product_a}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{p.product_b}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{p.co_occurrence}x</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.support_pct.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.confidence_a_to_b_pct.toFixed(0)}%</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.lift >= 1.5 ? 'bg-emerald-50 text-emerald-700' : p.lift >= 1 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {p.lift.toFixed(2)}x
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
