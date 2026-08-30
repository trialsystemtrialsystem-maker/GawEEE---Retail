'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface ExpenseRequest {
  id: string
  description: string
  amount: number
  status: string
  requested_by_name: string
  approved_by_name: string | null
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

export function FinanceApprovals({ outletId, canDecide }: { outletId: string; canDecide: boolean }) {
  const [requests, setRequests] = useState<ExpenseRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/expense-requests?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setRequests(data.requests ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/expense-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), outlet_id: outletId }),
      })
      if (res.ok) {
        showToast('Pengajuan berhasil dikirim', 'success')
        setForm({ description: '', amount: '' })
        setShowForm(false)
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      const res = await fetch(`/api/expense-requests/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Ajukan Pengeluaran'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input
            label="Deskripsi"
            required
            placeholder="Beli galon air minum"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="Nominal (Rp)"
            type="number"
            min="1"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <div className="flex items-end">
            <Button type="submit" isLoading={isSubmitting}>
              Kirim
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : requests.length === 0 ? (
        <Alert variant="info">Belum ada pengajuan pengeluaran.</Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Diajukan Oleh</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Nominal</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                {canDecide && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-gray-600">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-2 text-gray-900">{r.description}</td>
                  <td className="px-4 py-2 text-gray-600">{r.requested_by_name}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(r.amount)}</td>
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
      )}
    </div>
  )
}
