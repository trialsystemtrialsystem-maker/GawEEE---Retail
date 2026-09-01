'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Shift {
  id: string
  opening_cash: number
  closing_cash: number | null
  total_transactions: number
  expected_closing_cash: number | null
  cash_variance: number | null
  status: string
  shift_start_time: string | null
  shift_end_time: string | null
}

export function CashierShiftManager({ outletId }: { outletId: string }) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/cashier-shifts?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setShifts(data.shifts ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const openShift = shifts.find((s) => s.status === 'open')

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/cashier-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, opening_cash: Number(openingCash) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuka shift')
        return
      }
      showToast('Shift kasir dibuka', 'success')
      setOpeningCash('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault()
    if (!openShift) return
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/cashier-shifts/${openShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_cash: Number(closingCash) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menutup shift')
        return
      }
      showToast('Shift kasir ditutup', 'success')
      setClosingCash('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        {error && <Alert variant="danger">{error}</Alert>}
        {isLoading ? (
          <p className="text-sm text-gray-400">Memuat…</p>
        ) : openShift ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Shift aktif sejak {openShift.shift_start_time ? formatDateTime(openShift.shift_start_time) : '-'}
            </p>
            <p className="text-lg font-bold text-gray-900">Kas Awal: {formatCurrency(openShift.opening_cash)}</p>
            <form onSubmit={handleClose} className="flex flex-wrap items-end gap-3">
              <Input label="Hitung Kas Sekarang (Rp)" type="number" min="0" required value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
              <Button type="submit" isLoading={isSubmitting}>
                Tutup Kasir
              </Button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleOpen} className="flex flex-wrap items-end gap-3">
            <Input label="Kas Awal (Rp)" type="number" min="0" required value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            <Button type="submit" isLoading={isSubmitting}>
              Buka Kasir
            </Button>
          </form>
        )}
      </Card>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Mulai</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Selesai</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Kas Awal</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Kas Akhir</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada riwayat shift</td>
              </tr>
            ) : (
              shifts.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{s.shift_start_time ? formatDateTime(s.shift_start_time) : '-'}</td>
                  <td className="px-4 py-2 text-gray-700">{s.shift_end_time ? formatDateTime(s.shift_end_time) : '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(s.opening_cash)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{s.closing_cash !== null ? formatCurrency(s.closing_cash) : '-'}</td>
                  <td className={`px-4 py-2 text-right font-medium ${s.cash_variance === null ? 'text-gray-400' : s.cash_variance === 0 ? 'text-gray-700' : s.cash_variance! < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {s.cash_variance !== null ? formatCurrency(s.cash_variance) : '-'}
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
