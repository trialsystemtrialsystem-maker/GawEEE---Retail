'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatDate } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Period {
  id: string
  period_start: string
  period_end: string
  status: 'open' | 'closed'
  closed_at: string | null
}

// Default to last month: the usual thing to close.
function lastMonthRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function PeriodsManager({ canManage }: { canManage: boolean }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [periods, setPeriods] = useState<Period[]>([])
  const [range, setRange] = useState(lastMonthRange)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    if (!outletId) return
    const res = await fetch(`/api/accounting/periods?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setPeriods(data.periods ?? [])
    else setError(typeof data.error === 'string' ? data.error : 'Gagal memuat periode')
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function close(e: React.FormEvent) {
    e.preventDefault()
    if (!window.confirm(`Tutup buku ${range.start} s/d ${range.end}? Jurnal baru di rentang ini akan ditolak sampai periode dibuka kembali.`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet_id: outletId, period_start: range.start, period_end: range.end }) })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menutup periode')
        return
      }
      showToast('Periode ditutup', 'success')
      load()
    } finally {
      setBusy(false)
    }
  }

  async function reopen(id: string) {
    if (!window.confirm('Buka kembali periode ini? Jurnal penutup akan dibatalkan.')) return
    const res = await fetch(`/api/accounting/periods/${id}/reopen`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Gagal membuka periode')
      return
    }
    showToast('Periode dibuka kembali', 'success')
    load()
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  return (
    <div className="space-y-4">
      <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info">
        Tutup buku memindahkan laba/rugi periode ke Laba Ditahan lewat jurnal penutup, lalu mengunci rentang tanggalnya. Laporan Laba Rugi tetap menampilkan
        pendapatan dan beban periode tersebut.
      </Alert>

      {canManage && (
        <Card>
          <form onSubmit={close} className="flex flex-wrap items-end gap-3">
            <Input name="close_start" label="Dari" type="date" required value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
            <Input name="close_end" label="Sampai" type="date" required value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
            <Button type="submit" isLoading={busy}>Tutup Buku</Button>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Periode</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Ditutup</th>
              {canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {periods.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Belum ada periode yang ditutup</td></tr>
            ) : (
              periods.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-gray-900">{formatDate(p.period_start)} – {formatDate(p.period_end)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {p.status === 'closed' ? 'Ditutup' : 'Terbuka'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{p.closed_at ? formatDate(p.closed_at) : '-'}</td>
                  {canManage && (
                    <td className="px-3 py-2">
                      {p.status === 'closed' && <button className="text-red-600 hover:underline" onClick={() => reopen(p.id)}>Buka kembali</button>}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
