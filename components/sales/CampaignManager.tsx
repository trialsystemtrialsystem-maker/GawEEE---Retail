'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface CampaignRequest {
  id: string
  campaign_name: string
  platform: 'meta' | 'google' | 'tiktok' | 'other'
  budget_amount: number
  notes: string | null
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  requested_by_name: string
  approved_by_name: string | null
  created_at: string
}

const PLATFORM_LABEL: Record<CampaignRequest['platform'], string> = { meta: 'Meta (FB/IG)', google: 'Google Ads', tiktok: 'TikTok Ads', other: 'Lainnya' }
const STATUS_LABEL: Record<CampaignRequest['status'], string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', completed: 'Selesai' }
const STATUS_COLOR: Record<CampaignRequest['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-brand-50 text-brand-700',
  rejected: 'bg-red-50 text-red-700',
  completed: 'bg-emerald-50 text-emerald-700',
}

export function CampaignManager({ outletId, canDecide }: { outletId: string; canDecide: boolean }) {
  const [requests, setRequests] = useState<CampaignRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ campaign_name: '', platform: 'meta' as CampaignRequest['platform'], budget_amount: '', notes: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/campaign-requests?outlet_id=${outletId}`)
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
      const res = await fetch('/api/campaign-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget_amount: Number(form.budget_amount), notes: form.notes || undefined, outlet_id: outletId }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mengajukan kampanye', 'danger')
        return
      }
      showToast('Pengajuan kampanye berhasil dikirim', 'success')
      setForm({ campaign_name: '', platform: 'meta', budget_amount: '', notes: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      const res = await fetch(`/api/campaign-requests/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) load()
    } finally {
      setBusyId(null)
    }
  }

  async function markCompleted(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/campaign-requests/${id}/complete`, { method: 'POST' })
      if (res.ok) {
        showToast('Kampanye ditandai selesai', 'success')
        load()
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">Pelacak anggaran &amp; persetujuan internal — belum terhubung ke API platform iklan manapun (Meta/Google/TikTok).</Alert>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Ajukan Kampanye'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input name="campaign_name" label="Nama Kampanye" required value={form.campaign_name} onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))} placeholder="mis. Promo Akhir Tahun" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as CampaignRequest['platform'] }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(['meta', 'google', 'tiktok', 'other'] as const).map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <Input name="budget_amount" label="Anggaran (Rp)" type="number" min="1" required value={form.budget_amount} onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value }))} />
          <Input name="campaign_notes" label="Catatan (opsional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting}>
              Kirim Pengajuan
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : requests.length === 0 ? (
        <Alert variant="info">Belum ada pengajuan kampanye.</Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Kampanye</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Platform</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Diajukan Oleh</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Anggaran</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                {canDecide && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-gray-600">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-2 text-gray-900">
                    {r.campaign_name}
                    {r.notes && <p className="text-xs text-gray-400">{r.notes}</p>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{PLATFORM_LABEL[r.platform]}</td>
                  <td className="px-4 py-2 text-gray-600">{r.requested_by_name}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(r.budget_amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  {canDecide && (
                    <td className="px-4 py-2">
                      {r.status === 'pending' && (
                        <div className="flex gap-3">
                          <button onClick={() => decide(r.id, 'approved')} disabled={busyId === r.id} className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                            Setujui
                          </button>
                          <button onClick={() => decide(r.id, 'rejected')} disabled={busyId === r.id} className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50">
                            Tolak
                          </button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={() => markCompleted(r.id)} disabled={busyId === r.id} className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50">
                          Tandai Selesai
                        </button>
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
