'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface MyRequest {
  id: string
  leave_type: 'izin' | 'sakit' | 'libur'
  start_date: string
  end_date: string
  reason: string
  status: string
}

const TYPE_LABEL: Record<string, string> = { izin: 'Izin', sakit: 'Sakit', libur: 'Libur/Cuti' }
const TYPE_ICON: Record<string, string> = { izin: '📄', sakit: '🤒', libur: '🏖️' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]',
  approved: 'bg-[var(--status-good)]/10 text-[var(--status-good)]',
  rejected: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
}

export function LeaveRequestForm({ outletId }: { outletId: string }) {
  const [myRequests, setMyRequests] = useState<MyRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [leaveType, setLeaveType] = useState<'izin' | 'sakit' | 'libur'>('izin')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/leave-requests?outlet_id=${outletId}&requested_by=me`)
    const data = await res.json()
    if (res.ok) setMyRequests(data.requests ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, leave_type: leaveType, start_date: startDate, end_date: endDate || startDate, reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mengajukan izin', 'danger')
        return
      }
      showToast('Pengajuan berhasil dikirim', 'success')
      setStartDate('')
      setEndDate('')
      setReason('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {(['izin', 'sakit', 'libur'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLeaveType(t)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                leaveType === t ? 'border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]' : 'border-gray-200 text-gray-600'
              }`}
            >
              <span className="text-xl">{TYPE_ICON[t]}</span>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Tanggal Mulai" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Tanggal Selesai (opsional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Alasan</label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Jelaskan alasan pengajuan…"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          />
        </div>
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Kirim Pengajuan
        </Button>
      </form>

      <div className="rounded-2xl border border-[var(--brand-100)] bg-white shadow-sm">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-[var(--brand-700)]">Riwayat Pengajuan Saya</h3>
        <ul className="divide-y divide-gray-100">
          {isLoading ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">Memuat…</li>
          ) : myRequests.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">Belum ada pengajuan</li>
          ) : (
            myRequests.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {TYPE_ICON[r.leave_type]} {TYPE_LABEL[r.leave_type]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                </div>
                <p className="text-gray-500">
                  {formatDate(r.start_date)}
                  {r.end_date !== r.start_date && ` – ${formatDate(r.end_date)}`}
                </p>
                <p className="text-gray-600">{r.reason}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
