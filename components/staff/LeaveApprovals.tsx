'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils/formatting'

interface LeaveRequest {
  id: string
  leave_type: 'izin' | 'sakit' | 'libur'
  start_date: string
  end_date: string
  reason: string
  status: string
  requested_by_name: string
  created_at: string
}

const TYPE_LABEL: Record<string, string> = { izin: 'Izin', sakit: 'Sakit', libur: 'Libur/Cuti' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

export function LeaveApprovals({ outletId, canDecide }: { outletId: string; canDecide: boolean }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/leave-requests?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setRequests(data.requests ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      const res = await fetch(`/api/leave-requests/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) load()
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return <p className="text-sm text-gray-400">Memuat…</p>
  if (requests.length === 0) return <Alert variant="info">Belum ada pengajuan izin/sakit/libur.</Alert>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Diajukan Oleh</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Jenis</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            {canDecide && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2 text-gray-900">{r.requested_by_name}</td>
              <td className="px-4 py-2 text-gray-600">{TYPE_LABEL[r.leave_type]}</td>
              <td className="px-4 py-2 text-gray-600">
                {formatDate(r.start_date)}
                {r.end_date !== r.start_date && ` – ${formatDate(r.end_date)}`}
              </td>
              <td className="px-4 py-2 text-gray-600">{r.reason}</td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status]}`}>{r.status}</span>
              </td>
              {canDecide && (
                <td className="px-4 py-2">
                  {r.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => decide(r.id, 'approved')}
                        disabled={busyId === r.id}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => decide(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
