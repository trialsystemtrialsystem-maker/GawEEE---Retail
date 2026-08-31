'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDate, formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Stocktake {
  id: string
  scheduled_date: string
  status: string
  total_variance_value: number | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'Sedang Berjalan',
  completed: 'Selesai',
  approved: 'Disetujui',
}

export function StocktakeManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [sessions, setSessions] = useState<Stocktake[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/stocktakes?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setSessions(data.stocktakes ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/stocktakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, scheduled_date: scheduledDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal memulai stok opname')
        return
      }
      showToast('Sesi stok opname dimulai', 'success')
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Mulai Stok Opname'}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-3 rounded-lg border border-gray-200 p-4">
          <Input label="Tanggal" type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          <Button type="submit" isLoading={isSubmitting}>
            Mulai
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nilai Selisih</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada sesi stok opname</td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{formatDate(s.scheduled_date)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === 'completed' || s.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {s.total_variance_value !== null ? formatCurrency(s.total_variance_value) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/dashboard/inventory/stocktake/${s.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      Lihat →
                    </Link>
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
